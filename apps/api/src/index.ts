import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, query } from './db';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

app.get('/status', (req, res) => {
  res.json({ status: 'ok', message: 'Workout Analyzer API is running' });
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await query('SELECT current_database(), now()');
    res.json({ 
      status: 'success', 
      database: result.rows[0].current_database,
      time: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/exercises', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        name,
        description,
        category,
        subcategory,
        image_path,
        video_path,
        camera_angle,
        status,
        created_at
      FROM exercises
      WHERE status = true
      ORDER BY created_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/exercises/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM exercises WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exercise not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });
  }

  try {
    const result = await query('SELECT * FROM Customers WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    if (user.password !== password) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    // Update last login
    await query('UPDATE Customers SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    res.json({ 
      status: 'success', 
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/exercises/:id/rules', async (req, res) => {
  try {
    const result = await query('SELECT * FROM exercise_pose_rules WHERE exercise_id = $1', [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/tracking-config', async (req, res) => {
  try {
    const result = await query("SELECT * FROM tracking_configs WHERE id = 'global'");
    if (result.rows.length === 0) {
      return res.json({
        model_type: 'full',
        ui_smoothing: 0.3,
        engine_smoothing: 0.0
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/voice-config', async (req, res) => {
  try {
    // 1. Fetch Global Settings
    const configResult = await query("SELECT * FROM voice_configs WHERE id = 'global'");
    const config = configResult.rows[0] || {
      min_interval_ms: 2200,
      phrase_cooldown_ms: 4000,
      reinforcement_probability: 0.70,
      speech_rate: 1.05,
      speech_pitch: 1.00,
      positive_reinforcements: [
        'Perfect form!',
        'Excellent depth!',
        'Great repp!',
        'Spot on!',
        'Nice job!',
        'Keep it up!',
        'Amazing control!'
      ]
    };

    // 2. Fetch Cues
    const cuesResult = await query("SELECT exercise_id, raw_cue, spoken_cue FROM voice_cues WHERE is_active = true");
    
    // Group cues for simple client consumption: { "global": { "cue": "spoken" }, "exercises": { "id": { "cue": "spoken" } } }
    const cues: Record<string, any> = { global: {}, exercises: {} };
    cuesResult.rows.forEach(row => {
      if (!row.exercise_id) {
        cues.global[row.raw_cue] = row.spoken_cue;
      } else {
        if (!cues.exercises[row.exercise_id]) {
          cues.exercises[row.exercise_id] = {};
        }
        cues.exercises[row.exercise_id][row.raw_cue] = row.spoken_cue;
      }
    });

    // 3. Fetch Failure Guidance
    const failureResult = await query("SELECT failure_keyword, spoken_advice FROM voice_failure_guidance WHERE is_active = true");
    const failureGuidance = failureResult.rows.reduce((acc, row) => {
      acc[row.failure_keyword] = row.spoken_advice;
      return acc;
    }, {} as Record<string, string>);

    res.json({
      config,
      cues,
      failure_guidance: failureGuidance
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});


app.post('/sessions', async (req, res) => {
  const { customer_id, exercise_id } = req.body;
  try {
    const result = await query(
      'INSERT INTO workout_sessions (customer_id, exercise_id) VALUES ($1, $2) RETURNING id',
      [customer_id, exercise_id]
    );
    res.json({ status: 'success', session_id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.patch('/sessions/:id', async (req, res) => {
  const { total_reps, average_accuracy, total_duration_seconds, status } = req.body;
  try {
    await query(
      'UPDATE workout_sessions SET total_reps = $1, average_accuracy = $2, total_duration_seconds = $3, status = $4, end_time = CURRENT_TIMESTAMP WHERE id = $5',
      [total_reps, average_accuracy, total_duration_seconds, status || 'completed', req.params.id]
    );
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/sessions', async (req, res) => {
  const { customer_id } = req.query;
  if (!customer_id) {
    return res.status(400).json({ status: 'error', message: 'customer_id is required' });
  }

  try {
    const result = await query(`
      SELECT 
        s.id,
        s.customer_id,
        s.exercise_id,
        s.start_time,
        s.end_time,
        COALESCE(NULLIF(s.total_reps, 0), (SELECT COUNT(*)::int FROM workout_attempts wa WHERE wa.session_id = s.id AND wa.status = 'success')) as total_reps,
        COALESCE(NULLIF(s.average_accuracy, 0), (SELECT COALESCE(AVG(quality_score), 0)::numeric(5,2) FROM workout_rep_logs wr WHERE wr.session_id = s.id)) as average_accuracy,
        COALESCE(NULLIF(s.total_duration_seconds, 0), EXTRACT(EPOCH FROM (COALESCE(s.end_time, (SELECT MAX(created_at) FROM workout_attempts wa WHERE wa.session_id = s.id), s.start_time) - s.start_time))::int) as total_duration_seconds,
        s.status,
        e.name as exercise_name,
        e.category as exercise_category,
        e.subcategory as exercise_subcategory,
        (SELECT COUNT(*)::int FROM workout_attempts wa WHERE wa.session_id = s.id) as total_attempts
      FROM workout_sessions s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.customer_id = $1
      ORDER BY s.start_time DESC
    `, [customer_id]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/sessions/:id', async (req, res) => {
  try {
    // 1. Get session summary
    const sessionResult = await query(`
      SELECT s.*, e.name as exercise_name 
      FROM workout_sessions s 
      JOIN exercises e ON s.exercise_id = e.id 
      WHERE s.id = $1
    `, [req.params.id]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // 2. Get reps
    const repsResult = await query(`
      SELECT * FROM workout_rep_logs 
      WHERE session_id = $1 
      ORDER BY rep_number ASC
    `, [req.params.id]);

    // 3. Get attempts
    const attemptsResult = await query(`
      SELECT * FROM workout_attempts 
      WHERE session_id = $1 
      ORDER BY created_at ASC
    `, [req.params.id]);

    // 4. Get deviations
    const deviationsResult = await query(`
      SELECT * FROM workout_deviation_logs 
      WHERE session_id = $1 
      ORDER BY created_at ASC
    `, [req.params.id]);

    res.json({
      ...session,
      reps: repsResult.rows,
      attempts: attemptsResult.rows,
      deviations: deviationsResult.rows
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/sessions/:id/analytics', async (req, res) => {
  try {
    // Get joint angles for charting
    const anglesResult = await query(`
      SELECT 
        angle_name as name,
        angle_value as value,
        frame_number,
        rep_id,
        created_at
      FROM workout_joint_angles
      WHERE session_id = $1
      ORDER BY frame_number ASC
    `, [req.params.id]);

    // Group by frame_number for a consolidated time-series if needed,
    // or just return raw for the client to process.
    res.json(anglesResult.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/sessions/:id/reps', async (req, res) => {
  const { rep_number, start_frame_time, top_frame_time, end_frame_time, quality_score, duration_seconds, status, attempt_id } = req.body;
  try {
    const result = await query(
      'INSERT INTO workout_rep_logs (session_id, rep_number, start_frame_time, top_frame_time, end_frame_time, quality_score, duration_seconds, status, attempt_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [req.params.id, rep_number, start_frame_time, top_frame_time, end_frame_time, quality_score, duration_seconds, status, attempt_id]
    );
    res.json({ status: 'success', rep_id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/sessions/:id/deviations', async (req, res) => {
  const { rep_id, deviation_type, feedback_message, severity, frame_number } = req.body;
  try {
    await query(
      'INSERT INTO workout_deviation_logs (session_id, rep_id, deviation_type, feedback_message, severity, frame_number) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.params.id, rep_id, deviation_type, feedback_message, severity, frame_number]
    );
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/sessions/:id/frames', async (req, res) => {
  const { rep_id, frame_number, landmarks, frame_type, angles } = req.body;
  try {
    // Save landmarks
    const landmarkResult = await query(
      'INSERT INTO workout_landmark_frames (session_id, rep_id, frame_number, landmarks, frame_type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.id, rep_id, frame_number, JSON.stringify(landmarks), frame_type]
    );

    // Save angles if provided
    if (angles && Array.isArray(angles)) {
      for (const angle of angles) {
        await query(
          'INSERT INTO workout_joint_angles (session_id, rep_id, angle_name, angle_value, frame_number) VALUES ($1, $2, $3, $4, $5)',
          [req.params.id, rep_id, angle.name, angle.value, frame_number]
        );
      }
    }

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/sessions/:id/attempts', async (req, res) => {
  const { exercise_id, status, reason } = req.body;
  try {
    const result = await query(
      'INSERT INTO workout_attempts (session_id, exercise_id, status, reason) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.params.id, exercise_id, status, reason]
    );
    res.json({ status: 'success', attempt_id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});


app.listen(port, '0.0.0.0', async () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  await testConnection();
});
 
