const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Database Layer ────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');
const SCHEMA = { profile: null, sessions: [], grades: [] };

const db = {
  read() {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(SCHEMA, null, 2));
      return { ...SCHEMA };
    }
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      return { ...SCHEMA };
    }
  },
  write(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }
};

// ── Grading Engine (BGMax system) ─────────────────────────────
const GRADE_MAP = [
  { min: 80, grade: 'A',  points: 4.0, label: 'Excellent' },
  { min: 70, grade: 'B+', points: 3.5, label: 'Très Bien' },
  { min: 60, grade: 'B',  points: 3.0, label: 'Bien' },
  { min: 55, grade: 'C+', points: 2.5, label: 'Assez Bien' },
  { min: 50, grade: 'C',  points: 2.0, label: 'Passable' },
  { min: 45, grade: 'D',  points: 1.5, label: 'Insuffisant' },
  { min: 40, grade: 'E',  points: 1.0, label: 'Faible' },
  { min: 0,  grade: 'F',  points: 0.0, label: 'Échec' }
];

function getGradeInfo(mark) {
  const clamped = Math.max(0, Math.min(100, mark));
  const tier = GRADE_MAP.find(g => clamped >= g.min);
  return { ...tier, mark: clamped };
}

function getRank(gpa) {
  if (gpa >= 3.6) return { rank: 'Distinction Suprême', tier: 'gold', icon: '🏆' };
  if (gpa >= 3.0) return { rank: 'Mérite Académique', tier: 'silver', icon: '🥈' };
  if (gpa >= 2.0) return { rank: 'Performance Solide', tier: 'bronze', icon: '🥉' };
  if (gpa >= 1.0) return { rank: 'En Progression', tier: 'iron', icon: '📈' };
  return { rank: 'À Améliorer', tier: 'none', icon: '💪' };
}

// ── Statistical Utilities ─────────────────────────────────────
function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function linearRegression(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: 0 };
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += (x[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

// ── API Routes ────────────────────────────────────────────────

// Profile
app.get('/api/profile', (_req, res) => {
  res.json(db.read().profile);
});

app.post('/api/profile', (req, res) => {
  const { name, matricule } = req.body;
  if (!name || !matricule) {
    return res.status(400).json({ error: 'Nom et matricule requis' });
  }
  const data = db.read();
  data.profile = { name: name.trim(), matricule: matricule.trim() };
  db.write(data);
  res.json(data.profile);
});

// Sessions
app.get('/api/sessions', (_req, res) => {
  res.json(db.read().sessions);
});

app.post('/api/sessions', (req, res) => {
  const { subject, duration, focusLevel, sleepHours } = req.body;
  if (!subject || !duration) {
    return res.status(400).json({ error: 'Matière et durée requises' });
  }
  const data = db.read();
  const session = {
    id: uuidv4(),
    subject: subject.trim(),
    duration: Math.max(0, parseFloat(duration) || 0),
    focusLevel: Math.max(1, Math.min(10, parseInt(focusLevel) || 5)),
    sleepHours: Math.max(0, Math.min(16, parseFloat(sleepHours) || 7)),
    timestamp: new Date().toISOString()
  };
  data.sessions.push(session);
  db.write(data);
  res.status(201).json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  const data = db.read();
  data.sessions = data.sessions.filter(s => s.id !== req.params.id);
  db.write(data);
  res.json({ success: true });
});

// Grades
app.get('/api/grades', (_req, res) => {
  const data = db.read();
  const enriched = data.grades.map(g => ({
    ...g,
    ...getGradeInfo(g.mark)
  }));
  res.json(enriched);
});

app.post('/api/grades', (req, res) => {
  const { subject, mark, credits } = req.body;
  if (!subject || mark === undefined) {
    return res.status(400).json({ error: 'Matière et note requises' });
  }
  const data = db.read();
  const grade = {
    id: uuidv4(),
    subject: subject.trim(),
    mark: Math.max(0, Math.min(100, parseFloat(mark) || 0)),
    credits: Math.max(1, parseInt(credits) || 1),
    timestamp: new Date().toISOString()
  };
  data.grades.push(grade);
  db.write(data);
  res.status(201).json({ ...grade, ...getGradeInfo(grade.mark) });
});

app.delete('/api/grades/:id', (req, res) => {
  const data = db.read();
  data.grades = data.grades.filter(g => g.id !== req.params.id);
  db.write(data);
  res.json({ success: true });
});

// ── Analysis Engine ───────────────────────────────────────────
app.get('/api/analysis', (_req, res) => {
  const { sessions, grades } = db.read();

  if (sessions.length === 0 && grades.length === 0) {
    return res.json({
      ready: false,
      message: 'Ajoutez des sessions et des notes pour débloquer l\'analyse.'
    });
  }

  // Core metrics
  const totalHours = sessions.reduce((a, s) => a + s.duration, 0);
  const avgFocus = sessions.length > 0
    ? sessions.reduce((a, s) => a + s.focusLevel, 0) / sessions.length
    : 0;
  const avgSleep = sessions.length > 0
    ? sessions.reduce((a, s) => a + (s.sleepHours || 7), 0) / sessions.length
    : 0;

  // GPA calculation (weighted by credits)
  const enrichedGrades = grades.map(g => ({ ...g, ...getGradeInfo(g.mark) }));
  const totalWeightedPoints = enrichedGrades.reduce((a, g) => a + g.points * (g.credits || 1), 0);
  const totalCredits = enrichedGrades.reduce((a, g) => a + (g.credits || 1), 0);
  const gpa = totalCredits > 0 ? totalWeightedPoints / totalCredits : 0;
  const rankInfo = getRank(gpa);

  // Subject-level analysis
  const bySubject = {};
  sessions.forEach(s => {
    if (!bySubject[s.subject]) bySubject[s.subject] = { hours: 0, sessions: 0, focusSum: 0 };
    bySubject[s.subject].hours += s.duration;
    bySubject[s.subject].sessions += 1;
    bySubject[s.subject].focusSum += s.focusLevel;
  });
  enrichedGrades.forEach(g => {
    if (!bySubject[g.subject]) bySubject[g.subject] = { hours: 0, sessions: 0, focusSum: 0 };
    bySubject[g.subject].mark = g.mark;
    bySubject[g.subject].grade = g.grade;
  });

  // Correlations
  const studyHoursArr = Object.values(bySubject).filter(s => s.mark !== undefined).map(s => s.hours);
  const marksArr = Object.values(bySubject).filter(s => s.mark !== undefined).map(s => s.mark);
  const studyMarkCorrelation = pearsonCorrelation(studyHoursArr, marksArr);

  // Prediction: linear regression of study hours -> marks
  const reg = linearRegression(studyHoursArr, marksArr);
  const avgStudyHours = totalHours / Math.max(1, Object.keys(bySubject).length);
  const predictedNextMark = Math.min(100, Math.max(0, reg.intercept + reg.slope * (avgStudyHours * 1.15)));

  // Grade distribution
  const distribution = { A: 0, 'B+': 0, B: 0, 'C+': 0, C: 0, D: 0, E: 0, F: 0 };
  enrichedGrades.forEach(g => { distribution[g.grade] = (distribution[g.grade] || 0) + 1; });

  // Session timeline for chart
  const timeline = sessions.map(s => ({
    date: new Date(s.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    heures: s.duration,
    concentration: s.focusLevel,
    sommeil: s.sleepHours || 7
  }));

  // Subject performance chart
  const subjectPerformance = Object.entries(bySubject).map(([name, data]) => ({
    matière: name,
    heures: parseFloat(data.hours.toFixed(1)),
    note: data.mark || 0,
    concentration: data.sessions > 0 ? parseFloat((data.focusSum / data.sessions).toFixed(1)) : 0
  }));

  res.json({
    ready: true,
    summary: {
      gpa: parseFloat(gpa.toFixed(2)),
      totalHours: parseFloat(totalHours.toFixed(1)),
      avgFocus: parseFloat(avgFocus.toFixed(1)),
      avgSleep: parseFloat(avgSleep.toFixed(1)),
      totalSessions: sessions.length,
      totalGrades: grades.length,
      ...rankInfo
    },
    predictions: {
      nextMark: parseFloat(predictedNextMark.toFixed(1)),
      potentialGPA: parseFloat(Math.min(4.0, gpa * 1.1).toFixed(2)),
      correlation: parseFloat(studyMarkCorrelation.toFixed(3)),
      correlationLabel: studyMarkCorrelation > 0.6
        ? 'Forte corrélation positive'
        : studyMarkCorrelation > 0.3
          ? 'Corrélation modérée'
          : studyMarkCorrelation > 0
            ? 'Corrélation faible'
            : 'Pas suffisamment de données'
    },
    charts: {
      timeline,
      subjectPerformance,
      distribution: Object.entries(distribution)
        .filter(([, v]) => v > 0)
        .map(([grade, count]) => ({ grade, count }))
    },
    grades: enrichedGrades
  });
});

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve Frontend ───────────────────────────────────────────
const DIST_PATH = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
  });
}

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 Alvaro Analytics API`);
  console.log(`  ├─ Port:   ${PORT}`);
  console.log(`  ├─ DB:     ${DB_FILE}`);
  console.log(`  └─ Status: Opérationnel\n`);
});
