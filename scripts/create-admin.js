require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const { createPool } = require("../src/config/database");

function readSecret(promptText) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Execute este script em um terminal interativo para ocultar a senha."));
  }

  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(promptText);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Operação cancelada."));
          return;
        } else if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        } else if (character === "\u0008" || character === "\u007f") {
          value = Array.from(value).slice(0, -1).join("");
        } else if (!/[\u0000-\u001f\u007f]/u.test(character)) {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const email = (await prompt.question("E-mail do administrador: ")).trim().toLowerCase();
  prompt.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Informe um e-mail válido.");
  }

  const password = await readSecret("Senha (12 a 72 bytes): ");
  const confirmation = await readSecret("Confirme a senha: ");
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < 12 || bytes > 72) throw new Error("A senha deve ter de 12 a 72 bytes.");
  if (password !== confirmation) throw new Error("As senhas não conferem.");

  const pool = createPool();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, passwordHash]
    );
    console.log("Conta de administrador criada.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});