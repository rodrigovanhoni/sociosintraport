const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'rodrigovanhoni@gmail.com', // Coloque seu email aqui
    pass: 'tbmj apkn zhbp nxec'  // Cole a senha de app aqui
  }
});

// Função para teste
async function testarEmail() {
  try {
    const info = await transporter.sendMail({
      from: 'rodrigovanhoni@gmail.com',    // Seu email
      to: 'sintraport@outlook.com',   // Para quem você quer enviar
      subject: 'Teste NodeMailer',    // Assunto
      text: 'Se você recebeu este email, o NodeMailer está funcionando!' // Corpo do email
    });

    console.log('Email enviado com sucesso!');
    console.log('ID da mensagem:', info.messageId);
  } catch (error) {
    console.error('Erro ao enviar:', error);
  }
}

testarEmail();