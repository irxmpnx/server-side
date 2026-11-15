const { client } = require('../configs/db');

const UserModel = {
  async createUser({ firstName, lastName, phoneNumber, gender, username, passwordHash, role }) {
    const query = `
      INSERT INTO users (first_name, last_name, phone_number, gender, username, password_hash, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, first_name, last_name, username, role, created_at;
    `;
    const values = [firstName, lastName, phoneNumber, gender, username, passwordHash, role];
    const { rows } = await client.query(query, values);
    return rows[0];
  },

  async findByUsername(username) {
    const query = `SELECT * FROM users WHERE username = $1 LIMIT 1;`;
    const { rows } = await client.query(query, [username]);
    return rows[0];
  },

  async findById(id) {
    const query = `SELECT id, first_name, last_name, phone_number, gender, username, role FROM users WHERE id = $1;`;
    const { rows } = await client.query(query, [id]);
    return rows[0];
  }
};

module.exports = UserModel;