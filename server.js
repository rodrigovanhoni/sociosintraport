require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const bcrypt = require('bcrypt');
const session = require('express-session'); // Para gerenciar sessões

// Middleware para servir arquivos estáticos
app.use(express.static('public'));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Connected to database');
});

app.get('/', (req, res) => {
  res.send('API is running');
});

// Create a new member
//curl -X POST http://localhost:3000/socios -H "Content-Type: application/json" -d "{\"nome\":\"John Doe\", \"pare\":\"john@example.com\"}"
//curl -X POST http://localhost:3000/members -H "Content-Type: application/json" -d "{\"nome\":\"João Silva\", \"cpf\":\"12345678901\", \"data_nascimento\":\"1980-01-01\", \"parentesco\":\"Pai\"}"

// Configuração da sessão
app.use(session({
  secret: 'segredo_super_secreto', // Substituir por um segredo real
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use secure: true em produção com HTTPS
}));


// Rota de login
app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  
  // Verifica se o usuário existe no banco de dados
  const sql = 'SELECT * FROM usuarios WHERE usuario = ?';
  db.query(sql, [usuario], (err, result) => {
    if (err) throw err;
    if (result.length === 0) {
      return res.json({ success: false, type: 1 });
    }

    const user = result[0];

    const bcrypt = require('bcrypt');

    // Verifica se a senha está correta usando bcrypt
    bcrypt.compare(senha, user.senha, (err, isMatch) => {
      if (err) throw err;

      if (isMatch) {
        // Login bem-sucedido, inicia a sessão
        req.session.userId = user.id;
        res.json({ success: true });
      } else {
        res.json({ success: false, type: 2, pass: senha, newpass: user.senha });
      }
    });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, message: 'Erro ao fazer logout' });
    }
    res.clearCookie('connect.sid'); // Limpa o cookie da sessão no navegador
    return res.json({ success: true, message: 'Logout bem-sucedido' });
  });
});


app.post('/socios', (req, res) => {
  const {
    nome, cpf, data_nascimento, parentesco, socio, email, telefone, matricula,
    aposentado, grupoWhats, cargo, dataadmissao, 
    dataassociacao, enderecorua, endereconum, enderecoobs, apelido, estadocivil
  } = req.body;

  // Campos obrigatórios
  if (!nome || !cpf) {
    return res.status(400).send('Nome e CPF são obrigatórios');
  }

  // Monta o SQL dinamicamente
  const fields = [];
  const values = [];
  const params = [];

  const data = {
    nome, cpf, data_nascimento, parentesco, socio, email, telefone, matricula,
    aposentado, grupoWhats, cargo, dataadmissao, 
    dataassociacao, enderecorua, endereconum, enderecoobs, apelido, estadocivil
  };

  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      fields.push(key);
      values.push('?');
      params.push(data[key]);
    }
  });

  const sql = `
    INSERT INTO socios (${fields.join(', ')})
    VALUES (${values.join(', ')})
  `;

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao cadastrar sócio');
    }
    res.send('Sócio cadastrado com sucesso');
  });
});


/*app.post('/socios', (req, res) => {

  const {
    nome, cpf, data_nascimento, parentesco, socio, email, telefone, matricula,
    aposentado, grupoWhats, cargo, dataadmissao, 
    dataassociacao, enderecorua, endereconum, enderecoobs, apelido, estadocivil
  } = req.body;

  const sql = `
    INSERT INTO socios 
    (nome, cpf, data_nascimento, parentesco, socio, email, telefone, matricula, 
    aposentado, grupoWhats, cargo, dataadmissao, dataassociacao, 
    enderecorua, endereconum, enderecoobs, apelido, estadocivil)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    nome, cpf, data_nascimento, parentesco, socio, email, telefone, matricula,
    aposentado, grupoWhats, cargo, dataadmissao, dataassociacao,
    enderecorua, endereconum, enderecoobs, apelido, estadocivil
  ], (err, result) => {
    if (err) {
      // Apenas envia a resposta de erro uma vez
      console.error(err);
      return res.status(500).send('Erro ao cadastrar sócio');
    }
    
    // Apenas envia a resposta de sucesso se não houver erro
    res.send('Sócio cadastrado com sucesso');
  });
});
*/

app.get('/cargos', (req, res) => {
  const sql = 'SELECT idCargo, nome FROM cargo';
  
  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao buscar cargos');
    }
    
    res.json(result); // Envia os cargos como JSON
  });
});


// Get all members
app.get('/socios', (req, res) => {
  // Definir a página e o limite (itens por página)
  //const page = parseInt(req.query.page) || 1; // Página atual (padrão é 1)
  //const limit = parseInt(req.query.limit) || 10; // Itens por página (padrão é 10)
  
  // Calcular o offset (onde começar a buscar)
  //const offset = (page - 1) * limit;

  // Query para buscar os sócios com paginação
  const sql = 'select * from socios1';
  db.query(sql, (err, result) => {
    if (err) throw err;

    // Contar o número total de sócios para calcular o número de páginas
    const countSql = 'SELECT COUNT(*) AS total FROM socios1';
    db.query(countSql, (err, countResult) => {
      if (err) throw err;

      //const totalSocios = countResult[0].total;
      //const totalPages = Math.ceil(totalSocios / limit); // Calcula o número de páginas

      // Retorna os sócios e as informações da paginação
      res.json({
        //page: page,
        //totalPages: totalPages,
        //limit: limit,
        socios: result
      });
    });
  });
});


// Get a member by ID
app.get('/socios/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM socios WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) throw err;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(result);
  });
});

// Rota para verificar se o CPF pertence a um sócio ou dependente
app.get('/socio/cpf/:cpf', (req, res) => {
  const cpf = req.params.cpf;

  // Consulta para verificar se o CPF existe na tabela de sócios
  const sqlSocio = 'SELECT * FROM socios WHERE cpf = ? AND socio IS NULL';
  
  db.query(sqlSocio, [cpf], (err, resultSocio) => {
    if (err) {
      return res.status(500).send('Erro ao consultar o CPF');
    }

    if (resultSocio.length > 0) {
      return res.json({ status: 'socio', data: resultSocio[0] }); // Retorna se for sócio
    }

    // Se não for sócio, verifica se o CPF existe na tabela de dependentes
    const sqlDependente = 'SELECT * FROM socios WHERE cpf = ? AND socio IS NOT NULL';
    
    db.query(sqlDependente, [cpf], (err, resultDependente) => {
      if (err) {
        return res.status(500).send('Erro ao consultar o CPF');
      }

      if (resultDependente.length > 0) {
        return res.json({ status: 'dependente', data: resultDependente[0] }); // Retorna se for dependente
      }

      // Se não for sócio nem dependente
      return res.json({ status: 'nenhum', message: 'CPF não encontrado como sócio ou dependente' });
    });
  });
});

// Rota para listar todos os dependentes de um sócio específico
app.get('/socios/:id/dependentes', (req, res) => {
  const socioId = req.params.id;
  const sql = 'SELECT * FROM socios WHERE socio = ?';

  db.query(sql, [socioId], (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results);
  });
});


// Update a member
app.put('/socios/:id', (req, res) => {
  const { id } = req.params;
  const { nome, cpf, data_nascimento, parentesco, socio } = req.body;
  const sql = 'UPDATE socios SET nome = ?, cpf = ?, data_nascimento = ?, parentesco = ?, socio = ? WHERE id = ?';
  db.query(sql, [nome, cpf, data_nascimento, parentesco, socio, id], (err, result) => {
    if (err) throw err;
    res.send('Atualizado com sucesso');
  });
});

// Delete a member
app.delete('/socios/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM socios WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) throw err;
    res.send('Deletado com sucesso');
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

