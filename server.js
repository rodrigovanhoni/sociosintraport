require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const multer = require("multer");

// No início do arquivo, depois dos requires
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Configuração para múltiplos campos (usado no cadastro de dependentes)
const uploadMultiple = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).fields([
  { name: "foto", maxCount: 1 },
  { name: "documento", maxCount: 1 },
]);

//const upload = multer();
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Configuração do SNS (adicione junto com outras configurações)
const sns = new SNSClient({
  region: 'sa-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Configura o EJS como view engine
app.set("view engine", "ejs");

// Configura o diretório de views (geralmente ./views)
app.set("views", "./views");

const bcrypt = require("bcrypt");
const session = require("express-session"); // Para gerenciar sessões

// Aumentando os limites do express
//app.use(express.json({ limit: "50mb" }));
//app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// Middleware para servir arquivos estáticos
app.use(express.static("public"));

// Middleware para aumentar o limite do payload
app.use((req, res, next) => {
  res.setHeader("X-Nginx-Upload-Limit", "50m");
  next();
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Adicione no seu .env
    pass: process.env.EMAIL_PASSWORD, // Adicione no seu .env
  },
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

async function enviarCodigoVerificacao(email) {
  const codigo = Math.floor(100000 + Math.random() * 900000); // Código de 6 dígitos

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Código de Verificação - SINTRAPORT",
      html: `
        <h2>SINTRAPORT - Código de Verificação</h2>
        <p>Seu código de verificação é: <strong>${codigo}</strong></p>
        <p>Este código expira em 10 minutos.</p>
        <p>Se você não solicitou este código, por favor ignore este email.</p>
      `,
    });

    return codigo;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw error;
  }
}

// Função para formatar o número de telefone
function formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove todos os caracteres não numéricos
    let numbers = phone.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos (DDD + 9 + número)
    if (numbers.length !== 11) {
        console.log('Número de telefone inválido:', phone);
        return null;
    }
    
    // Adiciona o código do país (+55) e retorna
    return `+55${numbers}`;
}

// Modifique a rota /solicitar-codigo para enviar tanto email quanto SMS
app.post('/solicitar-codigo', async (req, res) => {
  const { cpf } = req.body;
  
  try {
    // Busque o sócio no banco de dados (mantenha seu código atual)
    const socio = await pool.query(
      'SELECT * FROM socios WHERE cpf = $1',
      [cpf]
    );

    if (socio.rows.length === 0) {
      return res.json({ success: false, message: 'Sócio não encontrado' });
    }

    // Gere o código (mantenha seu código atual)
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Salve o código no banco (mantenha seu código atual)
    await pool.query(
      'UPDATE socios SET verification_code = $1, code_expiration = NOW() + INTERVAL \'5 minutes\' WHERE cpf = $2',
      [codigo, cpf]
    );

    // Envie o email (mantenha seu código atual)
    //await enviarEmail(socio.rows[0].email, 'Código de Verificação', `Seu código é: ${codigo}`);

    // Adicione o envio do SMSconst phoneNumber = formatPhoneNumber(socio.rows[0].telefone);
    const phoneNumber = formatPhoneNumber(socio.rows[0].telefone); // Certifique-se de que este campo existe na sua tabela
    const ultimosDigitos = phoneNumber.slice(-4); // Pega os últimos 4 dígitos

    if (phoneNumber) {
      console.log('Número de telefone:', phoneNumber);
      console.log('Credenciais AWS:', process.env.AWS_ACCESS_KEY_ID ? 'Presente' : 'Ausente');
      console.log('AWS Config:', {
        region: process.env.AWS_REGION || 'não definida',
        accessKeyIdPresente: !!process.env.AWS_ACCESS_KEY_ID,
        secretAccessKeyPresente: !!process.env.AWS_SECRET_ACCESS_KEY,
        accessKeyIdComprimento: process.env.AWS_ACCESS_KEY_ID?.length,
        secretAccessKeyComprimento: process.env.AWS_SECRET_ACCESS_KEY?.length
      });
      const params = {
        Message: `Seu código de verificação do Sintraport é: ${codigo}`,
        PhoneNumber: phoneNumber, // Certifique-se de que está no formato +5541999999999
      };

      const command = new PublishCommand(params);
      await sns.send(command);
    }

    res.json({ 
      success: true, 
      message: 'Código enviado com sucesso',
      telefone: `*****-${ultimosDigitos}` // Retorna os últimos dígitos mascarados
    });
  } catch (error) {
    console.error('Erro:', error);
    res.json({ success: false, message: 'Erro ao enviar código' });
  }
});

app.post("/verificar-codigo", async (req, res) => {
  const { cpf, codigo } = req.body;

  try {
    const result = await pool.query(
      `SELECT * FROM socios 
             WHERE cpf = $1 
             AND verification_code = $2 
             AND CAST(code_expiration AS timestamp) > NOW()`,
      [cpf, codigo],
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Código inválido ou expirado",
      });
    }

    // Salva o ID do sócio na session
    req.session.socioId = result.rows[0].id;
    req.session.authenticated = true;
    req.session.isMaster = false;

    await pool.query(
      "UPDATE socios SET verification_code = NULL, code_expiration = NULL WHERE cpf = $1",
      [cpf],
    );

    res.json({
      success: true,
      message: "Código verificado com sucesso",
      socioId: result.rows[0].id,
      
    });
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao verificar código",
    });
  }
});

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
        console.log('logando...');
        // Login bem-sucedido, inicia a sessão
        req.session.userId = user.id;
        req.session.socioId = user.id;
        req.session.authenticated = true;
        req.session.master = true;

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
    grupowhats,
    cargo,
    dataadmissao,
    dataassociacao,
    enderecorua,
    endereconum,
    enderecoobs,
    apelido,
    estadocivil,
    enderecocep, 
    enderecobairro, 
    enderecocidade, 
    enderecoestado,
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
    grupowhats,
    cargo,
    dataadmissao,
    dataassociacao,
    enderecorua,
    endereconum,
    enderecoobs,
    apelido,
    estadocivil,
    enderecocep, 
    enderecobairro, 
    enderecocidade, 
    enderecoestado,
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
      res.json({ 
        success: true, 
        message: "Sócio cadastrado com sucesso"
      });
    })
    .catch((err) => {
      console.error("Erro completo:", err);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao cadastrar sócio"
      });
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

// No seu server.js, junto com as outras funções
/*function checkAuth(req, res, next) {
  if (!req.session.authenticated || !req.session.socioId) {
    return res.redirect("/");
  }
  next();
}*/

const checkAuth = (req, res, next) => {
  // Bypass temporário para desenvolvimento
  req.session.userId = 1;
  req.session.email = "teste@teste.com";
  return next();

  /* CÓDIGO ORIGINAL - descomentar quando terminar os testes
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
    */
};

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

app.get('/editar-socio/:id', checkAuth, async (req, res) => {
  try {
      // Busca os dados do sócio
      const socioResult = await pool.query('SELECT * FROM socios WHERE id = $1', [req.params.id]);
      const socio = socioResult.rows[0];
      
      // Busca os cargos
      const cargos = await pool.query('SELECT * FROM cargo');
      
      if (!socio) {
          return res.status(404).send('Sócio não encontrado');
      }
      console.log('Cargos:', cargos.rows); // Adicione esta linha
      console.log('Sócio:', socio); // E esta linha

      // Renderiza a mesma view, mas com dados do sócio e modo edição
      res.render('novo-socio', {
          user: req.user,
          cargos: cargos.rows,
          socio: socio,
          modoEdicao: true
      });
  } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao carregar página");
  }
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

app.get("/dependentes/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o ID da URL corresponde ao ID da session
    if (!req.session.master && parseInt(id) !== req.session.socioId) {
      return res.redirect("/"); // Ou envie uma mensagem de erro
    }

    const socioResult = await pool.query(
      "SELECT * FROM socios WHERE id = $1",
      [id],
    );

    if (socioResult.rows.length === 0) {
      return res.status(404).send("Sócio não encontrado");
    }

    const dependentesResult = await pool.query(
      "SELECT * FROM dependentes WHERE socio_id = $1",
      [id],
    );

    res.render("dependentes", {
      socio: socioResult.rows[0],
      dependentes: dependentesResult.rows,
      socioId: id,
      isMaster: !!req.session.master, // Passa a informação se é diretor
    });
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).send("Erro ao carregar dependentes");
  }
});

// Rota de cadastro atualizada
app.post("/dependentes", checkAuth, uploadMultiple, async (req, res) => {
  try {
    const { nome, cpf, parentesco, data_nascimento, socio_id } = req.body;
    let fotoBase64 = null;
    let documentoBase64 = null;

    // Se uma foto foi enviada, converte para base64
    if (req.files["foto"]) {
      const foto = req.files["foto"][0];
      fotoBase64 = `data:${foto.mimetype};base64,${foto.buffer.toString("base64")}`;
    }

    // Se um documento foi enviado, converte para base64
    if (req.files["documento"]) {
      const documento = req.files["documento"][0];
      documentoBase64 = `data:${documento.mimetype};base64,${documento.buffer.toString("base64")}`;
    }

    // Ajusta a data para evitar o problema do timezone
    const data = new Date(data_nascimento);
    data.setUTCHours(12);

    const result = await pool.query(
      `INSERT INTO dependentes (
        nome, 
        cpf, 
        parentesco, 
        data_nascimento, 
        foto, 
        documento_comprobatorio,
        status,
        socio_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        nome,
        cpf,
        parentesco,
        data,
        fotoBase64,
        documentoBase64,
        "pendente",
        socio_id,
      ],
    );

    console.log("Data retornada do banco:", result.rows[0].data_nascimento);

    res.redirect(`/dependentes/${socio_id}`);
  } catch (error) {
    console.error("Erro ao cadastrar dependente:", error);
    res.status(500).send("Erro ao cadastrar dependente");
  }
});

// Rota para visualizar o documento
app.get("/dependentes/:id/documento", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT documento_comprobatorio FROM dependentes WHERE id = $1",
      [id],
    );

    if (!result.rows[0] || !result.rows[0].documento_comprobatorio) {
      return res.status(404).send("Documento não encontrado");
    }

    // O documento já está em formato base64 com o tipo MIME
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Documento Comprobatório</title>
        </head>
        <body style="margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center;">
          <embed
            src="${result.rows[0].documento_comprobatorio}"
            type="application/pdf"
            width="100%"
            height="100%"
          />
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Erro ao buscar documento:", error);
    res.status(500).send("Erro ao buscar documento");
  }
});

app.post("/dependentes/:id/status", checkAuth, async (req, res) => {
  try {
    // Verifica se é um diretor
    if (!req.session.master) {
      return res.status(403).json({ error: "Não autorizado" });
    }

    const { id } = req.params;
    const { status, motivo_reprovacao } = req.body;

    // Validação do status
    if (!["aprovado", "reprovado", "pendente"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    // Atualiza o status no banco de dados
    await pool.query(
      "UPDATE dependentes SET status = $1, data_homologacao = CURRENT_TIMESTAMP, homologado_por = $2, motivo_reprovacao = $3 WHERE id = $4",
      [status, req.session.userId, motivo_reprovacao, id],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

app.get('/dependentes-pendentes', checkAuth, async (req, res) => {
  try {
      // Busca todos os dependentes pendentes junto com informações do sócio
      const result = await pool.query(`
          SELECT 
              d.*,
              s.nome as nome_socio,
              s.cpf as cpf_socio
          FROM dependentes d
          JOIN socios s ON d.socio_id = s.id
          WHERE d.status = 'pendente'
          ORDER BY s.nome DESC
      `);

      res.render('dependentes-pendentes', {
          dependentes: result.rows,
          user: req.user,
          isMaster: !!req.session.master
      });
  } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao carregar dependentes pendentes");
  }
});

app.get('/novo-socio', checkAuth, async (req, res) => {
  try {
      // Busca os cargos do banco de dados
      const cargos = await pool.query('SELECT * FROM cargo');
      
      res.render('novo-socio', {
          user: req.user,
          cargos: cargos.rows,
          modoEdicao: false, // Indica que é modo de criação
          socio: {}
      });
  } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao carregar página");
  }
});

app.get('/dependentes-pendentes/contador', checkAuth, async (req, res) => {
  try {
      const result = await pool.query(`
          SELECT COUNT(*) 
          FROM dependentes 
          WHERE status = 'pendente'
      `);
      
      res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar pendências" });
  }
});

app.post("/dependentes/:id/delete", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { socio_id } = req.body;

    await pool.query("DELETE FROM dependentes WHERE id = $1", [id]);

    res.redirect(`/dependentes/${socio_id}`);
  } catch (error) {
    console.error("Erro ao deletar dependente:", error);
    res.status(500).send("Erro ao deletar dependente");
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
  const { 
    nome, cpf, data_nascimento, email, telefone, 
    aposentado, grupowhats, cargo, matricula, // Adicionado matrícula
    dataadmissao, dataassociacao, enderecocep, 
    enderecorua, endereconum, enderecoobs, 
    enderecobairro, enderecocidade, enderecoestado, 
    apelido, estadocivil 
} = req.body;

    console.log(data_nascimento);
    console.log(dataassociacao);
    console.log(dataadmissao);
    console.log(estadocivil);

     // Tratamento para campos numéricos
     const endereconumTratado = endereconum === '' ? null : endereconum;
    
    
    // Converter strings vazias para null e tratar tipos numéricos
    const aposentadoNum = aposentado === '' ? null : parseInt(aposentado);
    const grupowhatsNum = grupowhats === '' ? null : parseInt(grupowhats);
    const cargoNum = cargo === '' ? null : parseInt(cargo);
    const matriculaNum = matricula === '' ? null : parseInt(matricula); // Adicionado conversão da matrícula

    

  const sql = `UPDATE socios 
        SET nome = NULLIF($1, ''),
            cpf = NULLIF($2, ''),
            data_nascimento = $3::date,
            email = NULLIF($4, ''),
            telefone = NULLIF($5, ''),
            aposentado = $6,
            grupowhats = $7,
            cargo = $8,
            matricula = $9, /* Adicionado matrícula */
            dataadmissao = $10::date,
            dataassociacao = $11::date,
            enderecocep = NULLIF($12, ''),
            enderecorua = NULLIF($13, ''),
            endereconum = NULLIF($14, ''),
            enderecoobs = NULLIF($15, ''),
            enderecobairro = NULLIF($16, ''),
            enderecocidade = NULLIF($17, ''),
            enderecoestado = NULLIF($18, ''),
            apelido = NULLIF($19, ''),
            estadocivil = NULLIF($20, '')
        WHERE id = $21
        RETURNING *`;

        const sqlParams = [
          nome, 
          cpf, 
          data_nascimento,
          email,
          telefone,
          aposentadoNum,
          grupowhatsNum,
          cargoNum,
          matriculaNum, // Adicionado matrícula
          dataadmissao,
          dataassociacao,
          enderecocep,
          enderecorua,
          endereconum,
          enderecoobs,
          enderecobairro,
          enderecocidade,
          enderecoestado,
          apelido,
          estadocivil,
          id
        ];

        console.log('SQL Query:', sql);
        console.log('Parâmetros:', sqlParams);  
    pool.query(sql,sqlParams)
    
    .then(result => {
        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Sócio não encontrado" 
            });
        }
        res.json({ 
            success: true, 
            message: "Atualizado com sucesso" 
        });
    })
    .catch(err => {
        console.error("Erro ao atualizar sócio(1):", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao atualizar sócio(2)" 
        });
    });
});

app.put("/socios/:id/atualizar-contato", (req, res) => {
  const { id } = req.params;
  const { 
      email, telefone, 
      enderecocep, enderecorua, endereconum, enderecoobs, 
      enderecobairro, enderecocidade, enderecoestado 
  } = req.body;

  const sql = `
      UPDATE socios 
      SET email = NULLIF($1, ''),
          telefone = NULLIF($2, ''),
          enderecocep = NULLIF($3, ''),
          enderecorua = NULLIF($4, ''),
          endereconum = NULLIF($5, ''),
          enderecoobs = NULLIF($6, ''),
          enderecobairro = NULLIF($7, ''),
          enderecocidade = NULLIF($8, ''),
          enderecoestado = NULLIF($9, '')
      WHERE id = $10
      RETURNING *
  `;

  const sqlParams = [
      email,
      telefone,
      enderecocep,
      enderecorua,
      endereconum,
      enderecoobs,
      enderecobairro,
      enderecocidade,
      enderecoestado,
      id
  ];

  pool.query(sql, sqlParams)
      .then(result => {
          if (result.rowCount === 0) {
              return res.status(404).json({ 
                  success: false, 
                  message: "Sócio não encontrado" 
              });
          }
          res.json({ 
              success: true, 
              message: "Dados de contato atualizados com sucesso" 
          });
      })
      .catch(err => {
          console.error("Erro ao atualizar dados de contato:", err);
          res.status(500).json({ 
              success: false, 
              message: "Erro ao atualizar dados de contato" 
          });
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
  try {
    const { name, memberNumber, cpf, issueDate, validUntil, photo } = req.body;

    // Configurar cabeçalhos
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=carteirinha.pdf",
    );

    // Criar documento PDF
    const doc = new PDFDocument({
      size: [250, 270],
      margin: 5,
      bufferPages: true, // Importante para manipulação de buffer
    });

    // Stream do PDF
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.send(pdfBuffer);
    });

    const addWatermark = () => {
      // Salvar o estado atual
      doc.save();

      // Configurar a marca d'água
      doc.fill("#f0f0f0"); // Cor cinza bem clara
      doc.fontSize(40);
      doc.rotate(-45, { origin: [100, 125] }); // Rotacionar 45 graus

      // Calcular posição central
      const watermarkText = "SINTRAPORT";
      const textWidth = doc.widthOfString(watermarkText);
      const textHeight = doc.currentLineHeight();

      // Desenhar a marca d'água
      doc.text(
        watermarkText,
        100 - textWidth / 2, // Centralizar horizontalmente
        125 - textHeight / 2, // Centralizar verticalmente
        {
          opacity: 0.2, // 20% de opacidade
        },
      );

      // Restaurar o estado anterior
      doc.restore();
    };

    // Adicionar marca d'água
    addWatermark();

    // Cabeçalho
    doc
      .fontSize(16)
      .text("SINTRAPORT", 20, 10, { align: "center" })
      .fontSize(12)
      .text("Carteira de Identificação do Sócio", 10, 40, { align: "center" })
      .moveDown();

    // Foto
    if (photo && photo.startsWith("data:image")) {
      try {
        const base64Data = photo.split(",")[1];
        const imageBuffer = Buffer.from(base64Data, "base64");
        doc.image(imageBuffer, 10, 60, {
          fit: [100, 120],
        });
      } catch (error) {
        console.error("Erro ao processar foto:", error);
      }
    }

    // Informações do membro
    doc.fontSize(11).text(`Nome:\n ${name}`, 120, 70);

    doc
      .fontSize(10)
      .text(`Nº de Sócio:\n ${memberNumber}`, 120, 110)
      .text(`CPF:\n ${cpf}`, 120, 140)
      .text(`Data de Emissão:\n ${issueDate}`, 120, 170)
      .text(`Válido até:\n ${validUntil}`, 120, 200);

    // Rodapé
    doc
      .fontSize(8)
      .text("Esta carteira é de uso pessoal \ne intransferível", 10, 230, {
        align: "center",
      });

    // Finalizar documento
    doc.end();
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    res.status(500).json({ error: "Erro ao gerar PDF" });
  }
});

// ... código anterior ...
// Nova rota para buscar membro por CPF
app.get("/api/member/:cpf", async (req, res) => {
  try {
    const cpf = req.params.cpf;
    console.log("CPF buscado:", cpf);

    // Consulta ao banco de dados
    const sqlSocio =
      "SELECT *, true as is_socio FROM socios WHERE cpf = $1 AND socio IS NULL";
    let socioResult = await pool.query(sqlSocio, [cpf]);
    console.log("tmp1");
    if (socioResult.rows.length === 0) {
      console.log("Sócio não encontrado");
      // Se não for sócio, verifica se é dependente
      socioResult = await pool.query(
        "SELECT *, false as is_socio FROM dependentes WHERE cpf = $1",
        [cpf],
      );

      // Se for dependente, verifica o status
      if (socioResult.rows.length > 0) {
        console.log("dependente encontrado");
        const dependente = socioResult.rows[0];
        if (dependente.status === 'pendente') {
          return res.status(403).json({ 
            error: "Dependente aguardando aprovação",
            status: "pendente"
          });
        } else if (dependente.status === 'reprovado') {
          return res.status(403).json({ 
            error: "Cadastro de dependente não aprovado",
            status: "reprovado",
            motivo: dependente.motivo_reprovacao
          });
        }
      }

    }
   

    if (socioResult.rows.length === 0) {
      return res.status(404).json({ error: "CPF não encontrado" });
    }
    // Pegando o primeiro resultado
    const data = socioResult.rows[0];
    console.log(data.is_socio);
    // Formatando as datas (assumindo que issueDate é a data atual e validUntil é 1 ano depois)
    const today = new Date();
    const validUntil = new Date(today);

    const is_socio = data.is_socio;
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const placeholderPhoto =
      data.foto ||
      "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"; // Usa a foto do banco ou placeholder se não existir

    // Retornando os dados formatados
    return res.json({
      name: data.nome, // ajuste conforme o nome da coluna no seu banco
      memberNumber: data.matricula, // ajuste conforme o nome da coluna no seu banco
      cpf: data.cpf,
      is_socio: data.is_socio,
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
