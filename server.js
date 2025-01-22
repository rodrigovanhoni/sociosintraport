require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const PDFDocument = require("pdfkit");

const multer = require("multer");
const upload = multer();

const app = express();
app.use(bodyParser.json());
app.use(cors());

const bcrypt = require("bcrypt");
const session = require("express-session"); // Para gerenciar sessões

// Aumentando os limites do express
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Middleware para servir arquivos estáticos
app.use(express.static("public"));

// Middleware para aumentar o limite do payload
app.use((req, res, next) => {
  res.setHeader("X-Nginx-Upload-Limit", "50m");
  next();
});
/*const db = mysql.createConnection({
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
});*/

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Testando a conexão
pool.connect((err) => {
  if (err) {
    console.error("Erro na conexão:", err);
    return;
  }
  console.log("Conectado ao banco de dados PostgreSQL");
});

app.get("/", (req, res) => {
  res.send("API is running");
});

// Configuração da sessão
app.use(
  session({
    secret: "segredo_super_secreto", // Substituir por um segredo real
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Use secure: true em produção com HTTPS
  }),
);

// Rota de login
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  // Verifica se o usuário existe no banco de dados
  const sql = "SELECT * FROM usuarios WHERE usuario = $1";
  pool.query(sql, [usuario], (err, result) => {
    if (err) throw err;
    if (result.rows.length === 0) {
      return res.json({ success: false, type: 1 });
    }

    const user = result.rows[0];

    const bcrypt = require("bcrypt");

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

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, message: "Erro ao fazer logout" });
    }
    res.clearCookie("connect.sid"); // Limpa o cookie da sessão no navegador
    return res.json({ success: true, message: "Logout bem-sucedido" });
  });
});

app.post("/socios", (req, res) => {
  // Log dos dados recebidos
  console.log("Dados recebidos no req.body:", req.body);

  const {
    nome,
    cpf,
    data_nascimento,
    parentesco,
    socio,
    email,
    telefone,
    matricula,
    aposentado,
    grupoWhats,
    cargo,
    dataadmissao,
    dataassociacao,
    enderecorua,
    endereconum,
    enderecoobs,
    apelido,
    estadocivil,
  } = req.body;

  // Campos obrigatórios
  if (!nome || !cpf) {
    return res.status(400).send("Nome e CPF são obrigatórios");
  }

  const data = {
    nome,
    cpf,
    data_nascimento,
    parentesco,
    socio,
    email,
    telefone,
    matricula,
    aposentado,
    grupoWhats,
    cargo,
    dataadmissao,
    dataassociacao,
    enderecorua,
    endereconum,
    enderecoobs,
    apelido,
    estadocivil,
  };

  // Log dos dados após destructuring
  console.log("Dados após processamento:", data);

  const fields = [];
  const values = [];
  const params = [];
  let paramCount = 1;

  Object.keys(data).forEach((key) => {
    // Adiciona verificação extra para 'undefined' como string
    if (
      data[key] !== undefined &&
      data[key] !== null &&
      data[key] !== "" &&
      data[key] !== "undefined"
    ) {
      fields.push(key);
      values.push(`$${paramCount}`);
      params.push(data[key]);
      paramCount++;
    }
  });

  // Log da query montada
  console.log("Query montada:", {
    fields,
    values,
    params,
    sql: `INSERT INTO socios (${fields.join(", ")}) VALUES (${values.join(", ")})`,
  });

  const sql = `
    INSERT INTO socios (${fields.join(", ")})
    VALUES (${values.join(", ")})
    RETURNING id
  `;

  pool
    .query(sql, params)
    .then((result) => {
      res.send("Sócio cadastrado com sucesso");
    })
    .catch((err) => {
      console.error("Erro completo:", err);
      res.status(500).send("Erro ao cadastrar sócio");
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

app.get("/cargos", (req, res) => {
  const sql = "SELECT idCargo, nome FROM cargo";

  pool
    .query(sql)
    .then((result) => {
      res.json(result.rows); // Note o .rows aqui
    })
    .catch((err) => {
      console.error("Erro ao buscar cargos:", err);
      res.status(500).send("Erro ao buscar cargos");
    });
});

app.get("/socios", (req, res) => {
  const sql = "SELECT * FROM socios";
  const countSql = "SELECT COUNT(*) AS total FROM socios";

  Promise.all([pool.query(sql), pool.query(countSql)])
    .then(([sociosResult, countResult]) => {
      res.json({
        socios: sociosResult.rows, // Note o .rows aqui
      });
    })
    .catch((err) => {
      console.error("Erro ao buscar sócios:", err);
      res.status(500).send("Erro ao buscar sócios");
    });
});

app.get("/socios/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM socios WHERE id = $1";

  pool
    .query(sql, [id])
    .then((result) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json(result.rows); // Note o .rows aqui
    })
    .catch((err) => {
      console.error("Erro ao buscar sócio:", err);
      res.status(500).send("Erro ao buscar sócio");
    });
});

app.get("/socio/cpf/:cpf", async (req, res) => {
  const cpf = req.params.cpf;

  try {
    // Verifica se é sócio
    const sqlSocio = "SELECT * FROM socios WHERE cpf = $1 AND socio IS NULL";
    const socioResult = await pool.query(sqlSocio, [cpf]);

    if (socioResult.rows.length > 0) {
      return res.json({
        status: "socio",
        data: socioResult.rows[0],
      });
    }

    // Se não for sócio, verifica se é dependente
    const sqlDependente =
      "SELECT * FROM socios WHERE cpf = $1 AND socio IS NOT NULL";
    const dependenteResult = await pool.query(sqlDependente, [cpf]);

    if (dependenteResult.rows.length > 0) {
      return res.json({
        status: "dependente",
        data: dependenteResult.rows[0],
      });
    }

    // Se não for sócio nem dependente
    return res.json({
      status: "nenhum",
      message: "CPF não encontrado como sócio ou dependente",
    });
  } catch (err) {
    console.error("Erro ao consultar CPF:", err);
    return res.status(500).send("Erro ao consultar o CPF");
  }
});

app.get("/socios/:id/dependentes", (req, res) => {
  const socioId = req.params.id;
  const sql = "SELECT * FROM socios WHERE socio = $1";

  pool
    .query(sql, [socioId])
    .then((result) => {
      res.json(result.rows); // Note o .rows aqui
    })
    .catch((err) => {
      console.error("Erro ao buscar dependentes:", err);
      res.status(500).send(err);
    });
});

app.put("/socios/:id", (req, res) => {
  const { id } = req.params;
  const { nome, cpf, data_nascimento, parentesco, socio } = req.body;
  const sql = `
    UPDATE socios 
    SET nome = $1, cpf = $2, data_nascimento = $3, parentesco = $4, socio = $5 
    WHERE id = $6
    RETURNING *`; // RETURNING * é útil para confirmar a atualização

  pool
    .query(sql, [nome, cpf, data_nascimento, parentesco, socio, id])
    .then((result) => {
      if (result.rowCount === 0) {
        // Nenhum registro foi atualizado
        return res.status(404).send("Sócio não encontrado");
      }
      res.send("Atualizado com sucesso");
    })
    .catch((err) => {
      console.error("Erro ao atualizar sócio:", err);
      res.status(500).send("Erro ao atualizar sócio");
    });
});

// Delete a member
app.delete("/socios/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM socios WHERE id = $1 RETURNING *";

  pool
    .query(sql, [id])
    .then((result) => {
      if (result.rowCount === 0) {
        // Nenhum registro foi deletado
        return res.status(404).send("Sócio não encontrado");
      }
      res.send("Deletado com sucesso");
    })
    .catch((err) => {
      console.error("Erro ao deletar sócio:", err);
      res.status(500).send("Erro ao deletar sócio");
    });
});

// Rota para gerar PDF
app.post("/api/generate-card", async (req, res) => {
  const { name, memberNumber, cpf, issueDate, validUntil, photo } = req.body;

  const doc = new PDFDocument({
    size: [400, 250],
    margin: 10,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=carteirinha.pdf");

  doc.pipe(res);

  // Cabeçalho
  doc
    .fontSize(16)
    .text("Nome do Sindicato", 50, 20, { align: "center" })
    .fontSize(12)
    .text("Carteira de Identificação do Sócio", 50, 40, { align: "center" })
    .moveDown();

  // Se houver foto, adiciona ela
  if (photo) {
    try {
      // Remove o prefixo "data:image/jpeg;base64," da string base64
      const base64Data = photo.split(",")[1];
      const imageBuffer = Buffer.from(base64Data, "base64");

      // Adiciona a foto no canto superior direito
      doc.image(imageBuffer, 300, 20, {
        fit: [80, 100], // tamanho da foto no PDF
        align: "right",
      });
    } catch (error) {
      console.error("Erro ao processar a foto:", error);
    }
  }

  // Informações do membro
  doc
    .fontSize(10)
    .text(`Nome: ${name}`, 50, 80)
    .text(`Nº de Sócio: ${memberNumber}`, 50, 100)
    .text(`CPF: ${cpf}`, 50, 120)
    .text(`Data de Emissão: ${issueDate}`, 50, 140)
    .text(`Válido até: ${validUntil}`, 50, 160);

  // Rodapé
  doc
    .fontSize(8)
    .text("Esta carteira é de uso pessoal e intransferível", 50, 200, {
      align: "center",
    });

  doc.end();
});

// ... código anterior ...
// Nova rota para buscar membro por CPF
app.get("/api/member/:cpf", async (req, res) => {
  try {
    const cpf = req.params.cpf;
    console.log("CPF buscado:", cpf);

    // Consulta ao banco de dados
    const sqlSocio = "SELECT * FROM socios WHERE cpf = $1 AND socio IS NULL";
    const socioResult = await pool.query(sqlSocio, [cpf]);

    if (socioResult.rows.length === 0) {
      return res.status(404).json({ error: "Membro não encontrado" });
    }

    // Pegando o primeiro resultado
    const data = socioResult.rows[0];

    // Formatando as datas (assumindo que issueDate é a data atual e validUntil é 1 ano depois)
    const today = new Date();
    const validUntil = new Date(today);
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const placeholderPhoto =
      data.foto ||
      "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"; // Usa a foto do banco ou placeholder se não existir

    // Retornando os dados formatados
    return res.json({
      name: data.nome, // ajuste conforme o nome da coluna no seu banco
      memberNumber: data.matricula, // ajuste conforme o nome da coluna no seu banco
      cpf: data.cpf,
      issueDate: today.toLocaleDateString("pt-BR"),
      validUntil: validUntil.toLocaleDateString("pt-BR"),
      photo: placeholderPhoto, // ajuste conforme o nome da coluna no seu banco
    });
  } catch (error) {
    console.error("Erro ao buscar membro:", error);
    res.status(500).json({ error: "Erro ao buscar membro: " + error.message });
  }
});

// Nova rota para upload de foto
app.post("/api/upload-photo/:cpf", upload.single("photo"), async (req, res) => {
  try {
    let { cpf } = req.params;
    const photoFile = req.file;

    console.log(cpf);

    // Formatar o CPF para o padrão XXX.XXX.XXX-XX
    cpf = cpf.replace(/\D/g, ""); // Remove tudo que não é número
    cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    console.log("CPF formatado:", cpf);

    if (!photoFile) {
      return res.status(400).json({ error: "Nenhuma foto enviada" });
    }

    // Converter a imagem para base64
    const photoBase64 = `data:${photoFile.mimetype};base64,${photoFile.buffer.toString("base64")}`;

    // Atualizar o banco de dados
    const updateQuery =
      "UPDATE socios SET foto = $1 WHERE cpf = $2 RETURNING *";
    const result = await pool.query(updateQuery, [photoBase64, cpf]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sócio não encontrado" });
    }

    res.json({ message: "Foto atualizada com sucesso" });
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    res
      .status(500)
      .json({ error: "Erro ao fazer upload da foto: " + error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
