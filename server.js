const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'submissions.json');

const STUDENTS = [
  "Emanuel Nunes",
  "Emanuelly Melo",
  "Leonardo Lima",
  "Maria Eduarda",
  "Maria Luisa *",
  "Micaela Dos Santos",
  "Nicolas Carvalho",
  "Pedro Henrique",
  "Priscila Evellyn",
  "Rayanna Ribeiro",
  "Rayra Alana",
  "Renata Sophia",
  "Rian De Sa Ribeiro",
  "Sarah Melo",
  "Sophia Da Silva",
  "Sophya Oliveira",
  "Taicilane Pedroza",
  "Victor Aldenney",
  "Victor Braiam",
  "Vitor Eduardo",
  "Vitoria Julia",
  "Yasmin Giovana *",
  "Yellen Biatriz",
  "NATANAEL MELHOR ALUNO"
];

// Load submissions from disk
function loadSubmissions() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading submissions:", err);
  }
  return {};
}

// Save submissions to disk
function saveSubmissions(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error saving submissions:", err);
  }
}

let submissions = loadSubmissions();

// SSE (Server-Sent Events) clients for real-time live dashboard
let sseClients = [];

function notifyClients() {
  const payload = JSON.stringify(getDashboardData());
  sseClients.forEach(client => {
    client.res.write(`data: ${payload}\n\n`);
  });
}

function getDashboardData() {
  const list = STUDENTS.map(name => {
    const sub = submissions[name];
    if (sub) {
      return {
        name,
        delivered: true,
        score: sub.score,
        total: sub.total || 8,
        submittedAt: sub.submittedAt,
        answers: sub.answers || []
      };
    }
    return {
      name,
      delivered: false,
      score: null,
      total: 8,
      submittedAt: null,
      answers: []
    };
  });

  const deliveredCount = list.filter(s => s.delivered).length;
  const totalStudents = STUDENTS.length;
  const avgScore = deliveredCount > 0 
    ? (list.filter(s => s.delivered).reduce((acc, s) => acc + s.score, 0) / deliveredCount).toFixed(1)
    : "0.0";

  return {
    school: "EETI Bilíngue Profª. Jacimar Da Silva Gama",
    class: "2º 4",
    subject: "Matemática",
    teacher: "Prof. Natanael",
    totalStudents,
    deliveredCount,
    pendingCount: totalStudents - deliveredCount,
    avgScore,
    students: list
  };
}

// Endpoint: List students for dropdown
app.get('/api/students-list', (req, res) => {
  res.json({ students: STUDENTS });
});

// Endpoint: Dashboard data
app.get('/api/dashboard', (req, res) => {
  res.json(getDashboardData());
});

// Endpoint: Real-time SSE stream
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial data immediately
  res.write(`data: ${JSON.stringify(getDashboardData())}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Endpoint: Submit activity
app.post('/api/submit', (req, res) => {
  const { studentName, score, total, answers } = req.body;

  if (!studentName || !STUDENTS.includes(studentName)) {
    return res.status(400).json({ error: "Nome de aluno não reconhecido na turma 2º 4." });
  }

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = now.toLocaleDateString('pt-BR');

  submissions[studentName] = {
    score: Number(score) || 0,
    total: Number(total) || 8,
    answers: answers || [],
    submittedAt: `${dateFormatted} às ${timeFormatted}`,
    timestamp: now.getTime()
  };

  saveSubmissions(submissions);
  notifyClients();

  res.json({
    success: true,
    message: "Atividade entregue com sucesso!",
    studentName,
    submittedAt: `${dateFormatted} às ${timeFormatted}`
  });
});

// Endpoint: Export CSV for teacher
app.get('/api/export-csv', (req, res) => {
  const data = getDashboardData();
  let csv = "Nome do Aluno,Status,Nota,Data e Hora\n";
  data.students.forEach(s => {
    const status = s.delivered ? "Entregou" : "Pendente";
    const nota = s.delivered ? `${s.score}/${s.total}` : "-";
    const hora = s.submittedAt ? `"${s.submittedAt}"` : "-";
    csv += `"${s.name}",${status},${nota},${hora}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="relatorio_2ano4_prof_natanael.csv"');
  res.send('\uFEFF' + csv);
});

// Fallback to student view
app.get('/professor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'professor.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Alunos: http://localhost:${PORT}`);
  console.log(`📊 Professor: http://localhost:${PORT}/professor`);
});
