require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const { createPool } = require("../src/config/database");

async function main() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const email = (await prompt.question("E-mail do administrador: ")).trim().toLowerCase();
  const password = await prompt.question("Senha (12 a 72 bytes): ");
  prompt.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Informe um e-mail válido.");
  }
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < 12 || bytes > 72) throw new Error("A senha deve ter de 12 a 72 bytes.");

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