import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import {
  Brain, Clock, Award, Plus, LayoutDashboard, User, Zap,
  TrendingUp, BookOpen, Trash2, CheckCircle, AlertTriangle,
  Moon, Target, BarChart3
} from 'lucide-react';

const API = 'http://localhost:5000/api';

// ── Reusable Sub-Components ──────────────────────────────────

function StatCard({ label, value, suffix, icon: Icon, color, badge, delay = 0 }) {
  return (
    <motion.div
      className="card"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="label">{label}</div>
          <div className="metric" style={{ color: color || 'var(--text-primary)' }}>
            {value}<span style={{ fontSize: '1.2rem', fontWeight: 400 }}>{suffix}</span>
          </div>
        </div>
        {Icon && (
          <div style={{
            width: 44, height: 44,
            borderRadius: 'var(--radius-sm)',
            background: `${color || 'var(--accent)'}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={22} color={color || 'var(--accent)'} />
          </div>
        )}
      </div>
      {badge && (
        <div className={`badge badge--${badge.type}`} style={{ marginTop: '0.75rem' }}>
          <div className="pulse-dot" style={{ background: badge.type === 'success' ? 'var(--success)' : 'var(--warning)' }} />
          {badge.text}
        </div>
      )}
    </motion.div>
  );
}

function SessionItem({ session, onDelete }) {
  return (
    <div className="session-item">
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{session.subject}</div>
        <div className="caption">
          {new Date(session.timestamp).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{session.duration}h</div>
          <div className="caption" style={{ color: 'var(--pink)' }}>Focus {session.focusLevel}/10</div>
        </div>
        {onDelete && (
          <button
            className="btn btn--ghost"
            style={{ padding: '0.5rem', borderRadius: '8px' }}
            onClick={() => onDelete(session.id)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function GradeRow({ grade, onDelete }) {
  const gradeColors = {
    A: 'var(--success)', 'B+': '#10b981', B: 'var(--accent)',
    'C+': 'var(--warning)', C: '#f59e0b', D: '#ef4444',
    E: '#dc2626', F: '#991b1b'
  };
  return (
    <div className="session-item">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 'var(--radius-sm)',
          background: `${gradeColors[grade.grade] || 'var(--accent)'}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '1rem', color: gradeColors[grade.grade]
        }}>
          {grade.grade}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{grade.subject}</div>
          <div className="caption">{grade.credits} crédit{grade.credits > 1 ? 's' : ''} · {grade.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{grade.mark}%</div>
        {onDelete && (
          <button className="btn btn--ghost" style={{ padding: '0.5rem', borderRadius: '8px' }} onClick={() => onDelete(grade.id)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#12121f', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.85rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: '0.8rem', color: p.color, display: 'flex', gap: '0.5rem' }}>
          <span style={{ opacity: 0.7 }}>{p.name}:</span> <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [analysis, setAnalysis] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [grades, setGrades] = useState([]);
  const [toast, setToast] = useState(null);

  // Form state
  const [sessionForm, setSessionForm] = useState({ subject: '', duration: '', focusLevel: 7, sleepHours: 7 });
  const [gradeForm, setGradeForm] = useState({ subject: '', mark: '', credits: 1 });
  const [profileForm, setProfileForm] = useState({ name: '', matricule: '' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [profRes, analRes, sessRes, gradeRes] = await Promise.all([
        axios.get(`${API}/profile`),
        axios.get(`${API}/analysis`),
        axios.get(`${API}/sessions`),
        axios.get(`${API}/grades`)
      ]);
      setProfile(profRes.data);
      setAnalysis(analRes.data);
      setSessions(sessRes.data || []);
      setGrades(gradeRes.data || []);
      if (profRes.data) setProfileForm(profRes.data);
    } catch (err) {
      console.error('Erreur réseau:', err);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddSession = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/sessions`, {
        ...sessionForm,
        duration: parseFloat(sessionForm.duration),
        sleepHours: parseFloat(sessionForm.sleepHours)
      });
      setSessionForm({ subject: '', duration: '', focusLevel: 7, sleepHours: 7 });
      showToast('Session enregistrée avec succès');
      fetchAll();
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleAddGrade = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/grades`, {
        ...gradeForm,
        mark: parseFloat(gradeForm.mark),
        credits: parseInt(gradeForm.credits)
      });
      setGradeForm({ subject: '', mark: '', credits: 1 });
      showToast('Note enregistrée avec succès');
      fetchAll();
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/profile`, profileForm);
      showToast('Profil mis à jour');
      fetchAll();
    } catch {
      showToast('Erreur de sauvegarde', 'error');
    }
  };

  const deleteSession = async (id) => {
    await axios.delete(`${API}/sessions/${id}`);
    showToast('Session supprimée');
    fetchAll();
  };

  const deleteGrade = async (id) => {
    await axios.delete(`${API}/grades/${id}`);
    showToast('Note supprimée');
    fetchAll();
  };

  const data = analysis;
  const s = data?.summary;

  const TABS = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de Bord' },
    { id: 'data', icon: Plus, label: 'Saisie' },
    { id: 'grades', icon: Award, label: 'Notes' },
    { id: 'profile', icon: User, label: 'Profil' }
  ];

  const ACCENT_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];

  return (
    <div className="fade-up">
      {/* ── Navbar ───────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar__brand">
          <div className="navbar__logo">
            <Brain size={20} color="#fff" />
          </div>
          <div>
            <div className="navbar__title">Alvaro Analytics</div>
            <div className="navbar__subtitle">Prédiction Académique</div>
          </div>
        </div>
        <div className="nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab ${tab === t.id ? 'nav-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Page Content ────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ──────── Dashboard ──────── */}
        {tab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Stat Row */}
            <div className="grid grid--stats" style={{ marginBottom: '1.5rem' }}>
              <StatCard
                label="Moyenne Générale"
                value={s?.gpa || '—'}
                suffix="/4.0"
                icon={Award}
                color="var(--accent)"
                badge={{ type: 'success', text: s?.rank || 'En attente' }}
                delay={0}
              />
              <StatCard
                label="Heures d'Étude"
                value={s?.totalHours || 0}
                suffix="h"
                icon={Clock}
                color="var(--pink)"
                badge={{ type: 'accent', text: `${s?.totalSessions || 0} sessions` }}
                delay={0.1}
              />
              <StatCard
                label="Score de Focus"
                value={s?.avgFocus || '—'}
                suffix="/10"
                icon={Target}
                color="var(--success)"
                delay={0.2}
              />
              <StatCard
                label="Sommeil Moyen"
                value={s?.avgSleep || '—'}
                suffix="h"
                icon={Moon}
                color="var(--warning)"
                delay={0.3}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid--main" style={{ marginBottom: '1.5rem' }}>
              <motion.div
                className="card"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="heading-section">
                  <BarChart3 size={20} color="var(--accent)" />
                  Évolution de l'Effort & Concentration
                </div>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.charts?.timeline || []}>
                      <defs>
                        <linearGradient id="gradH" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradF" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#555" tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="heures" name="Heures" stroke="#6366f1" fill="url(#gradH)" strokeWidth={2} />
                      <Area type="monotone" dataKey="concentration" name="Focus" stroke="#ec4899" fill="url(#gradF)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                className="card card--accent"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="heading-section">
                  <Zap size={20} color="var(--accent)" />
                  Prédictions IA
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <div>
                    <div className="label">Prochaine Note Estimée</div>
                    <div className="metric" style={{ color: 'var(--accent-hover)' }}>
                      {data?.predictions?.nextMark || '—'}<span style={{ fontSize: '1rem' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <div className="label">GPA Potentiel Optimisé</div>
                    <div className="metric metric--sm" style={{ color: 'var(--success)' }}>
                      {data?.predictions?.potentialGPA || '—'}
                    </div>
                  </div>
                  <div className="divider" />
                  <div>
                    <div className="label">Corrélation Effort → Notes</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.25rem' }}>
                      {data?.predictions?.correlation || '—'}
                    </div>
                    <div className="caption" style={{ marginTop: '0.25rem' }}>
                      {data?.predictions?.correlationLabel || ''}
                    </div>
                  </div>
                  <div className="divider" />
                  <div className="caption" style={{ lineHeight: 1.6 }}>
                    <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    En augmentant vos heures d'étude de 15%, votre prochaine note pourrait progresser de ~4 points.
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Subject Performance */}
            <div className="grid grid--main">
              <motion.div
                className="card"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <div className="heading-section">
                  <BookOpen size={20} color="var(--accent)" />
                  Performance par Matière
                </div>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.charts?.subjectPerformance || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis type="number" domain={[0, 100]} stroke="#555" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="matière" type="category" width={140} stroke="#555" tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="note" name="Note" radius={[0, 6, 6, 0]} barSize={20}>
                        {(data?.charts?.subjectPerformance || []).map((_, i) => (
                          <Cell key={i} fill={ACCENT_COLORS[i % ACCENT_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                className="card card--success"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="heading-section">
                  <TrendingUp size={20} color="var(--success)" />
                  Distribution des Notes
                </div>
                {data?.charts?.distribution?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {data.charts.distribution.map((d, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.grade}</span>
                          <span className="caption">{d.count} matière{d.count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.count / Math.max(1, grades.length)) * 100}%` }}
                            transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                            style={{
                              height: '100%',
                              borderRadius: 4,
                              background: `linear-gradient(90deg, ${ACCENT_COLORS[i % ACCENT_COLORS.length]}, ${ACCENT_COLORS[(i + 1) % ACCENT_COLORS.length]})`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <BarChart3 size={36} />
                    <p>Pas encore de données</p>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ──────── Data Entry ──────── */}
        {tab === 'data' && (
          <motion.div key="data" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid--forms" style={{ marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="heading-section">
                  <Clock size={20} color="var(--accent)" />
                  Enregistrer une Session d'Étude
                </div>
                <form onSubmit={handleAddSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="input-group">
                    <label>Matière</label>
                    <input className="input" placeholder="ex: Algorithmes" value={sessionForm.subject} onChange={e => setSessionForm({ ...sessionForm, subject: e.target.value })} required />
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Durée (heures)</label>
                      <input className="input" type="number" step="0.5" min="0.5" placeholder="2.5" value={sessionForm.duration} onChange={e => setSessionForm({ ...sessionForm, duration: e.target.value })} required />
                    </div>
                    <div className="input-group">
                      <label>Sommeil (heures)</label>
                      <input className="input" type="number" step="0.5" min="0" max="16" value={sessionForm.sleepHours} onChange={e => setSessionForm({ ...sessionForm, sleepHours: e.target.value })} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Niveau de Concentration: <strong>{sessionForm.focusLevel}/10</strong></label>
                    <input type="range" min="1" max="10" value={sessionForm.focusLevel} onChange={e => setSessionForm({ ...sessionForm, focusLevel: parseInt(e.target.value) })} />
                  </div>
                  <button className="btn btn--primary btn--block" type="submit">
                    <CheckCircle size={18} /> Enregistrer la Session
                  </button>
                </form>
              </div>

              <div className="card">
                <div className="heading-section">
                  <Award size={20} color="var(--accent)" />
                  Ajouter une Note
                </div>
                <form onSubmit={handleAddGrade} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="input-group">
                    <label>Matière</label>
                    <input className="input" placeholder="ex: Analyse des Données" value={gradeForm.subject} onChange={e => setGradeForm({ ...gradeForm, subject: e.target.value })} required />
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Note (0-100)</label>
                      <input className="input" type="number" min="0" max="100" placeholder="82" value={gradeForm.mark} onChange={e => setGradeForm({ ...gradeForm, mark: e.target.value })} required />
                    </div>
                    <div className="input-group">
                      <label>Crédits</label>
                      <input className="input" type="number" min="1" max="10" value={gradeForm.credits} onChange={e => setGradeForm({ ...gradeForm, credits: e.target.value })} />
                    </div>
                  </div>
                  <button className="btn btn--success btn--block" type="submit">
                    <CheckCircle size={18} /> Sauvegarder la Note
                  </button>
                </form>
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="card">
              <div className="heading-section">
                <BookOpen size={20} color="var(--accent)" />
                Sessions Récentes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 400, overflowY: 'auto' }}>
                {sessions.length === 0 ? (
                  <div className="empty-state"><Clock size={32} /><p>Aucune session enregistrée</p></div>
                ) : (
                  sessions.slice().reverse().map(s => (
                    <SessionItem key={s.id} session={s} onDelete={deleteSession} />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ──────── Grades ──────── */}
        {tab === 'grades' && (
          <motion.div key="grades" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="heading-section">
                <Award size={20} color="var(--accent)" />
                Bulletin de Notes
              </div>
              {/* Summary bar */}
              {data?.ready && (
                <div style={{
                  display: 'flex', gap: '2rem', padding: '1rem 1.5rem',
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                  marginBottom: '1.5rem', flexWrap: 'wrap'
                }}>
                  <div>
                    <div className="label">GPA</div>
                    <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{s?.gpa}/4.0</div>
                  </div>
                  <div>
                    <div className="label">Rang</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{s?.icon} {s?.rank}</div>
                  </div>
                  <div>
                    <div className="label">Total Crédits</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{grades.reduce((a, g) => a + (g.credits || 1), 0)}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {grades.length === 0 ? (
                  <div className="empty-state"><Award size={32} /><p>Aucune note enregistrée</p></div>
                ) : (
                  grades.map(g => <GradeRow key={g.id} grade={g} onDelete={deleteGrade} />)
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ──────── Profile ──────── */}
        {tab === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="card" style={{ maxWidth: 540, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                  width: 88, height: 88, margin: '0 auto 1.25rem',
                  background: 'linear-gradient(135deg, var(--accent), var(--pink))',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px var(--accent-glow)'
                }}>
                  <User size={40} color="#fff" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Profil Membre</h2>
                <p className="caption">Gérez vos informations personnelles</p>
              </div>
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label>Nom Complet</label>
                  <input className="input" value={profileForm.name || ''} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="ex: Jean Dupont" required />
                </div>
                <div className="input-group">
                  <label>Matricule</label>
                  <input className="input" value={profileForm.matricule || ''} onChange={e => setProfileForm({ ...profileForm, matricule: e.target.value })} placeholder="ex: FE24A001" required />
                </div>
                <button className="btn btn--primary btn--block" type="submit">
                  <CheckCircle size={18} /> Sauvegarder
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ───────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            {toast.type === 'success'
              ? <CheckCircle size={18} color="var(--success)" />
              : <AlertTriangle size={18} color="var(--danger)" />
            }
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
