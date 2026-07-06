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

app.get('/metrics', async (req, res) => {
  try {
    const result = await query('SELECT * FROM master_metrics ORDER BY metric_name ASC');
    res.json(result.rows);
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
      WHERE status = true AND (is_deleted = false OR is_deleted IS NULL)
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
  const { customer_id, mode, trainer_id } = req.query;
  try {
    const systemRules = await query('SELECT * FROM exercise_pose_rules WHERE exercise_id = $1 AND creator_type = $2', [req.params.id, 'system']);
    let finalRules = systemRules.rows;
    
    if (mode === 'trainer' && trainer_id) {
       let trainerRules;
       if (customer_id) {
         trainerRules = await query('SELECT * FROM exercise_pose_rules WHERE exercise_id = $1 AND creator_type = $2 AND trainer_id = $3 AND (customer_id = $4 OR customer_id IS NULL)', [req.params.id, 'trainer', trainer_id, customer_id]);
       } else {
         trainerRules = await query('SELECT * FROM exercise_pose_rules WHERE exercise_id = $1 AND creator_type = $2 AND trainer_id = $3 AND customer_id IS NULL', [req.params.id, 'trainer', trainer_id]);
       }
       
       const ruleMap = new Map();
       finalRules.forEach(r => ruleMap.set(r.rule_name, r));
       
       // Process rules such that specific customer rules overwrite generic trainer rules
       const genericTrainerRules = trainerRules.rows.filter(r => !r.customer_id);
       const specificTrainerRules = trainerRules.rows.filter(r => r.customer_id);
       
       genericTrainerRules.forEach(r => ruleMap.set(r.rule_name, r)); 
       specificTrainerRules.forEach(r => ruleMap.set(r.rule_name, r)); 
       
       finalRules = Array.from(ruleMap.values());
    } else if (mode === 'self' && customer_id) {
       const selfRules = await query('SELECT * FROM exercise_pose_rules WHERE exercise_id = $1 AND creator_type = $2 AND customer_id = $3', [req.params.id, 'athlete', customer_id]);
       const ruleMap = new Map();
       finalRules.forEach(r => ruleMap.set(r.rule_name, r));
       selfRules.rows.forEach(r => ruleMap.set(r.rule_name, r));
       finalRules = Array.from(ruleMap.values());
    }

    res.json(finalRules);
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
    const cuesResult = await query("SELECT exercise_id, raw_cue, spoken_cue, display_cue, cue_type FROM voice_cues WHERE is_active = true");
    
    // Group cues for simple client consumption: { "global": { "cue": "spoken" }, "exercises": { "id": { "cue": "spoken" } } }
    const cues: Record<string, any> = { global: {}, exercises: {} };
    const display_cues: Record<string, any> = { global: {}, exercises: {} };
    const cue_types: Record<string, any> = { global: {}, exercises: {} };
    
    cuesResult.rows.forEach(row => {
      if (!row.exercise_id) {
        cues.global[row.raw_cue] = row.spoken_cue;
        display_cues.global[row.raw_cue] = row.display_cue || row.raw_cue;
        cue_types.global[row.raw_cue] = row.cue_type || 'info';
      } else {
        if (!cues.exercises[row.exercise_id]) {
          cues.exercises[row.exercise_id] = {};
          display_cues.exercises[row.exercise_id] = {};
          cue_types.exercises[row.exercise_id] = {};
        }
        cues.exercises[row.exercise_id][row.raw_cue] = row.spoken_cue;
        display_cues.exercises[row.exercise_id][row.raw_cue] = row.display_cue || row.raw_cue;
        cue_types.exercises[row.exercise_id][row.raw_cue] = row.cue_type || 'info';
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
      display_cues,
      cue_types,
      failure_guidance: failureGuidance
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});


app.post('/sessions', async (req, res) => {
  const { customer_id, exercise_id, recorded_mode, trainer_id } = req.body;
  try {
    const result = await query(
      'INSERT INTO workout_sessions (customer_id, exercise_id, recorded_mode, trainer_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [customer_id, exercise_id, recorded_mode || 'self', trainer_id || null]
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
    // Derive severity dynamically from voice_cues to enforce Single Source of Truth
    const cueResult = await query('SELECT cue_type FROM voice_cues WHERE raw_cue = $1 AND is_active = true LIMIT 1', [feedback_message]);
    const finalSeverity = (cueResult.rows.length > 0 && cueResult.rows[0].cue_type) ? cueResult.rows[0].cue_type : severity;

    await query(
      'INSERT INTO workout_deviation_logs (session_id, rep_id, deviation_type, feedback_message, severity, frame_number) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.params.id, rep_id, deviation_type, feedback_message, finalSeverity, frame_number]
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

app.get('/sessions/:id/frames', async (req, res) => {
  try {
    const framesResult = await query(`
      SELECT * FROM workout_landmark_frames 
      WHERE session_id = $1 
      ORDER BY rep_id ASC, frame_number ASC
    `, [req.params.id]);
    res.json(framesResult.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/sessions/:id/angles', async (req, res) => {
  try {
    const anglesResult = await query(`
      SELECT * FROM workout_joint_angles 
      WHERE session_id = $1 
      ORDER BY rep_id ASC, frame_number ASC
    `, [req.params.id]);
    res.json(anglesResult.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// --- Admin API Routes ---
app.get('/admin/exercises', async (req, res) => {
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
      WHERE (is_deleted = false OR is_deleted IS NULL)
      ORDER BY created_at ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/admin/exercises', async (req, res) => {
  const { name, description, dynamicProfile, category, subcategory, camera_angle, image_path, video_path } = req.body;
  if (!name || !dynamicProfile) {
    return res.status(400).json({ status: 'error', message: 'Name and dynamicProfile are required' });
  }

  try {
    const exerciseResult = await query(
      'INSERT INTO exercises (name, description, category, subcategory, camera_angle, image_path, video_path, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [name, description || '', category || 'AI Generated', subcategory || null, camera_angle || 'FRONT', image_path || null, video_path || null, true]
    );
    const exerciseId = exerciseResult.rows[0].id;

    await query(
      'INSERT INTO exercise_pose_rules (exercise_id, rule_name, rule_type, threshold_value, exercise_name, creator_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [exerciseId, 'DYNAMIC_PROFILE', 'custom', JSON.stringify(dynamicProfile), name, 'system']
    );

    res.json({ status: 'success', exercise_id: exerciseId });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.delete('/admin/exercises/:id', async (req, res) => {
  try {
    await query(
      'UPDATE exercises SET is_deleted = true WHERE id = $1',
      [req.params.id]
    );
    res.json({ status: 'success', message: 'Exercise deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/admin/exercises/:id', async (req, res) => {
  console.log("PUT /admin/exercises/:id invoked. Params:", req.params);
  console.log("Body:", req.body);
  const { name, description, dynamicProfile, category, subcategory, camera_angle, image_path, video_path } = req.body;
  if (!dynamicProfile) {
    return res.status(400).json({ status: 'error', message: 'dynamicProfile is required' });
  }

  try {
    if (name !== undefined || description !== undefined) {
      await query(
        'UPDATE exercises SET name = COALESCE($1, name), description = COALESCE($2, description), category = COALESCE($3, category), subcategory = COALESCE($4, subcategory), camera_angle = COALESCE($5, camera_angle), image_path = COALESCE($6, image_path), video_path = COALESCE($7, video_path) WHERE id = $8',
        [name, description, category, subcategory, camera_angle, image_path, video_path, req.params.id]
      );
    }

    const existing = await query('SELECT id FROM exercise_pose_rules WHERE exercise_id = $1 AND rule_name = $2 AND creator_type = $3', [req.params.id, 'DYNAMIC_PROFILE', 'system']);
    
    if (existing.rows.length > 0) {
      await query(
        'UPDATE exercise_pose_rules SET threshold_value = $1 WHERE id = $2',
        [JSON.stringify(dynamicProfile), existing.rows[0].id]
      );
    } else {
      const exResult = await query('SELECT name FROM exercises WHERE id = $1', [req.params.id]);
      if (exResult.rows.length > 0) {
        await query(
          'INSERT INTO exercise_pose_rules (exercise_id, rule_name, rule_type, threshold_value, exercise_name, creator_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [req.params.id, 'DYNAMIC_PROFILE', 'custom', JSON.stringify(dynamicProfile), exResult.rows[0].name, 'system']
        );
      }
    }

    res.json({ status: 'success' });
  } catch (error) {
    if ((error as any).code === '23505') { // Postgres unique_violation code
      return res.status(400).json({ status: 'error', message: 'An exercise with this name already exists. Please choose a different name.' });
    }
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/admin/exercises/:id/status', async (req, res) => {
  const { status } = req.body;
  if (status === undefined) {
    return res.status(400).json({ status: 'error', message: 'status is required' });
  }
  try {
    await query(
      'UPDATE exercises SET status = $1 WHERE id = $2',
      [status, req.params.id]
    );
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// --- Trainer API Routes ---

app.post('/trainer/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required' });
  try {
    const result = await query('SELECT * FROM trainers WHERE email = $1', [email]);
    if (result.rows.length === 0 || result.rows[0].password !== password) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
    const trainer = result.rows[0];
    res.json({ status: 'success', trainer: { id: trainer.id, email: trainer.email, name: trainer.name } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// --- Admin API Routes ---

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required' });
  try {
    const result = await query('SELECT * FROM admins WHERE email = $1', [email]);
    if (result.rows.length === 0 || result.rows[0].password !== password) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
    const admin = result.rows[0];
    res.json({ status: 'success', admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/trainer/athletes/add', async (req, res) => {
  const { trainer_id, email } = req.body;
  try {
    const customerResult = await query('SELECT id FROM customers WHERE email = $1', [email]);
    if (customerResult.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Athlete not found' });
    
    const customer_id = customerResult.rows[0].id;
    const linkCheck = await query('SELECT id FROM trainer_athletes WHERE trainer_id = $1 AND customer_id = $2', [trainer_id, customer_id]);
    if (linkCheck.rows.length > 0) return res.status(400).json({ status: 'error', message: 'Athlete already linked' });

    await query('INSERT INTO trainer_athletes (trainer_id, customer_id, status) VALUES ($1, $2, $3)', [trainer_id, customer_id, 'active']);
    res.json({ status: 'success', message: 'Athlete added successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/trainer/:id/athletes', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        c.id, 
        c.email, 
        c.name, 
        c.last_login, 
        ta.status,
        (SELECT COUNT(*)::int FROM workout_sessions ws WHERE ws.customer_id = c.id AND ws.trainer_id = $1 AND ws.recorded_mode = 'trainer') as total_sessions,
        (SELECT MAX(start_time) FROM workout_sessions ws WHERE ws.customer_id = c.id AND ws.trainer_id = $1 AND ws.recorded_mode = 'trainer') as last_session
      FROM trainer_athletes ta
      JOIN customers c ON ta.customer_id = c.id
      WHERE ta.trainer_id = $1
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/trainer/:id/athletes/:customer_id/status', async (req, res) => {
  const { status } = req.body;
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ status: 'error', message: 'Invalid status' });
  }
  try {
    const result = await query(
      'UPDATE trainer_athletes SET status = $1 WHERE trainer_id = $2 AND customer_id = $3 RETURNING *',
      [status, req.params.id, req.params.customer_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Link not found' });
    }
    res.json({ status: 'success', message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/trainer/:id/athletes/:customer_id/sessions', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        s.*,
        COALESCE(NULLIF(s.total_reps, 0), (SELECT COUNT(*)::int FROM workout_attempts wa WHERE wa.session_id = s.id AND wa.status = 'success')) as total_reps,
        COALESCE(NULLIF(s.average_accuracy, 0), (SELECT COALESCE(AVG(quality_score), 0)::numeric(5,2) FROM workout_rep_logs wr WHERE wr.session_id = s.id)) as average_accuracy,
        COALESCE(NULLIF(s.total_duration_seconds, 0), EXTRACT(EPOCH FROM (COALESCE(s.end_time, (SELECT MAX(created_at) FROM workout_attempts wa WHERE wa.session_id = s.id), s.start_time) - s.start_time))::int) as total_duration_seconds,
        e.name as exercise_name,
        (SELECT COUNT(*)::int FROM workout_attempts wa WHERE wa.session_id = s.id) as total_attempts
      FROM workout_sessions s 
      JOIN exercises e ON s.exercise_id = e.id 
      WHERE s.customer_id = $2 AND s.recorded_mode = 'trainer' AND s.trainer_id = $1
      ORDER BY s.start_time DESC
    `, [req.params.id, req.params.customer_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});
app.get('/trainer/:id/sessions', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        s.*,
        COALESCE(NULLIF(s.total_reps, 0), (SELECT COUNT(*)::int FROM workout_attempts wa WHERE wa.session_id = s.id AND wa.status = 'success')) as total_reps,
        COALESCE(NULLIF(s.average_accuracy, 0), (SELECT COALESCE(AVG(quality_score), 0)::numeric(5,2) FROM workout_rep_logs wr WHERE wr.session_id = s.id)) as average_accuracy,
        COALESCE(NULLIF(s.total_duration_seconds, 0), EXTRACT(EPOCH FROM (COALESCE(s.end_time, (SELECT MAX(created_at) FROM workout_attempts wa WHERE wa.session_id = s.id), s.start_time) - s.start_time))::int) as total_duration_seconds,
        e.name as exercise_name,
        e.category as category,
        c.name as athlete_name,
        c.email as athlete_email,
        (SELECT COUNT(*)::int FROM workout_attempts wa WHERE wa.session_id = s.id) as total_attempts
      FROM workout_sessions s 
      JOIN exercises e ON s.exercise_id = e.id 
      JOIN customers c ON s.customer_id = c.id
      WHERE s.recorded_mode = 'trainer' AND s.trainer_id = $1
      ORDER BY s.start_time DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/athletes/:id/trainers', async (req, res) => {
  try {
    const result = await query(`
      SELECT t.id, t.email, t.name
      FROM trainer_athletes ta
      JOIN trainers t ON ta.trainer_id = t.id
      WHERE ta.customer_id = $1 AND ta.status = 'active'
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/trainer/rules', async (req, res) => {
  const { exercise_id, rule_name, rule_type, threshold_value, exercise_name, trainer_id, customer_id } = req.body;
  try {
    const existing = await query('SELECT id FROM exercise_pose_rules WHERE exercise_id = $1 AND rule_name = $2 AND trainer_id = $3 AND customer_id = $4', [exercise_id, rule_name, trainer_id, customer_id || null]);
    
    if (existing.rows.length > 0) {
      await query(
        'UPDATE exercise_pose_rules SET threshold_value = $1 WHERE id = $2',
        [JSON.stringify(threshold_value), existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO exercise_pose_rules (exercise_id, rule_name, rule_type, threshold_value, exercise_name, creator_type, trainer_id, customer_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [exercise_id, rule_name, rule_type, JSON.stringify(threshold_value), exercise_name, 'trainer', trainer_id, customer_id || null]
      );
    }
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});
app.post('/athlete/rules', async (req, res) => {
  const { exercise_id, rule_name, rule_type, threshold_value, exercise_name, customer_id } = req.body;
  if (!customer_id) {
    return res.status(400).json({ status: 'error', message: 'customer_id is required' });
  }
  try {
    const existing = await query('SELECT id FROM exercise_pose_rules WHERE exercise_id = $1 AND rule_name = $2 AND creator_type = $3 AND customer_id = $4', [exercise_id, rule_name, 'athlete', customer_id]);
    
    if (existing.rows.length > 0) {
      await query(
        'UPDATE exercise_pose_rules SET threshold_value = $1 WHERE id = $2',
        [JSON.stringify(threshold_value), existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO exercise_pose_rules (exercise_id, rule_name, rule_type, threshold_value, exercise_name, creator_type, trainer_id, customer_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [exercise_id, rule_name, rule_type, JSON.stringify(threshold_value), exercise_name, 'athlete', null, customer_id]
      );
    }
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// --- Admin Trainer and Athlete Management API Routes ---
app.get('/admin/trainers', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        t.id, 
        t.name, 
        t.email, 
        t.status, 
        t.created_at,
        (SELECT COUNT(*)::int FROM trainer_athletes ta WHERE ta.trainer_id = t.id AND ta.status = 'active') as active_athletes
      FROM trainers t 
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/admin/trainers', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const result = await query('INSERT INTO trainers (name, email, password, status) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status', [name, email, password || 'trainer123', true]);
    res.json({ status: 'success', trainer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/admin/trainers/:id', async (req, res) => {
  const { name, email, status } = req.body;
  try {
    await query('UPDATE trainers SET name = $1, email = $2, status = $3 WHERE id = $4', [name, email, status, req.params.id]);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.get('/admin/athletes', async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, status, created_at, last_login FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/admin/athletes', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const result = await query('INSERT INTO customers (name, email, password, status) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status', [name, email, password || 'athlete123', true]);
    res.json({ status: 'success', athlete: result.rows[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/admin/athletes/:id', async (req, res) => {
  const { name, email, status } = req.body;
  try {
    await query('UPDATE customers SET name = $1, email = $2, status = $3 WHERE id = $4', [name, email, status, req.params.id]);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});




app.put('/admin/tracking-config', async (req, res) => {
  const { model_type, ui_smoothing, engine_smoothing } = req.body;
  try {
    const existing = await query("SELECT id FROM tracking_configs WHERE id = 'global'");
    if (existing.rows.length === 0) {
      await query(
        "INSERT INTO tracking_configs (id, model_type, ui_smoothing, engine_smoothing) VALUES ('global', $1, $2, $3)",
        [model_type, ui_smoothing, engine_smoothing]
      );
    } else {
      await query(
        "UPDATE tracking_configs SET model_type = $1, ui_smoothing = $2, engine_smoothing = $3 WHERE id = 'global'",
        [model_type, ui_smoothing, engine_smoothing]
      );
    }
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/admin/voice-config', async (req, res) => {
  const { min_interval_ms, phrase_cooldown_ms, reinforcement_probability, speech_rate, speech_pitch, positive_reinforcements } = req.body;
  try {
    const existing = await query("SELECT id FROM voice_configs WHERE id = 'global'");
    if (existing.rows.length === 0) {
      await query(
        "INSERT INTO voice_configs (id, min_interval_ms, phrase_cooldown_ms, reinforcement_probability, speech_rate, speech_pitch, positive_reinforcements) VALUES ('global', $1, $2, $3, $4, $5, $6)",
        [min_interval_ms, phrase_cooldown_ms, reinforcement_probability, speech_rate, speech_pitch, positive_reinforcements]
      );
    } else {
      await query(
        "UPDATE voice_configs SET min_interval_ms = $1, phrase_cooldown_ms = $2, reinforcement_probability = $3, speech_rate = $4, speech_pitch = $5, positive_reinforcements = $6 WHERE id = 'global'",
        [min_interval_ms, phrase_cooldown_ms, reinforcement_probability, speech_rate, speech_pitch, positive_reinforcements]
      );
    }
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// --- Failure Guidance Admin Routes ---

app.get('/admin/failure-guidance', async (req, res) => {
  try {
    const result = await query('SELECT * FROM voice_failure_guidance ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.post('/admin/failure-guidance', async (req, res) => {
  const { failure_keyword, spoken_advice, is_active } = req.body;
  try {
    const result = await query(
      'INSERT INTO voice_failure_guidance (failure_keyword, spoken_advice, is_active) VALUES ($1, $2, $3) RETURNING *',
      [failure_keyword, spoken_advice, is_active !== undefined ? is_active : true]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.put('/admin/failure-guidance/:id', async (req, res) => {
  const { id } = req.params;
  const { failure_keyword, spoken_advice, is_active } = req.body;
  try {
    const result = await query(
      'UPDATE voice_failure_guidance SET failure_keyword = $1, spoken_advice = $2, is_active = $3 WHERE id = $4 RETURNING *',
      [failure_keyword, spoken_advice, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

app.delete('/admin/failure-guidance/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM voice_failure_guidance WHERE id = $1', [id]);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, '0.0.0.0', async () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
    await testConnection();
  });
}

export default app;
 
