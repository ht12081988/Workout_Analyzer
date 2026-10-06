const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

const ALL_MASTER_METRICS = [
  // ==========================================
  // 1. HIPS & PELVIS COMPLEX
  // ==========================================
  {
    key: 'HIP_ABDUCTION_ANGLE',
    name: 'Hip Abduction Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 90,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: 'Bilateral maximum active lateral opening of thigh outward from pelvis lateral axis (0°-90°). Primary audit for gluteus medius capacity and acetabulofemoral clearance.\n\n' +
          '• Beginner / Risk Screening: >= 20° (Minimum clearance to prevent lateral impingement; in Reverse Hip CARs >= 18°).\n' +
          '• Intermediate / Functional Range: >= 35° (Healthy active mobility for full squats and unrestricted gait).\n' +
          '• Advanced / Athletic Capacity: >= 50° (High-capacity lateral mobility for martial arts, hockey, hurdling).\n' +
          '• Form Check / Fault Alert: In neutral/rest (e.g. CARs Phase 8): <= 25° (alerts if knee hovers outward instead of returning inside).'
  },
  {
    key: 'LEFT_HIP_ABDUCTION',
    name: 'Left Hip Abduction',
    category: 'Hips & Pelvis',
    min: 0,
    max: 90,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: '3D lateral flare and opening of left thigh outward from pelvic lateral axis (0°-90°). Audits left gluteus medius mobility and adductor tightness.\n\n' +
          '• Beginner / Risk Screening: >= 20° (In Reverse CARs >= 18°).\n' +
          '• Intermediate / Functional Range: >= 35°.\n' +
          '• Advanced / Athletic Capacity: >= 50°.\n' +
          '• Form Check / Fault Alert: Resting neutral <= 25°.'
  },
  {
    key: 'RIGHT_HIP_ABDUCTION',
    name: 'Right Hip Abduction',
    category: 'Hips & Pelvis',
    min: 0,
    max: 90,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: '3D lateral flare and opening of right thigh outward from pelvic lateral axis (0°-90°). Audits right gluteus medius mobility and adductor tightness.\n\n' +
          '• Beginner / Risk Screening: >= 20° (In Reverse CARs >= 18°).\n' +
          '• Intermediate / Functional Range: >= 35°.\n' +
          '• Advanced / Athletic Capacity: >= 50°.\n' +
          '• Form Check / Fault Alert: Resting neutral <= 25°.'
  },
  {
    key: 'KNEE_OUTSIDE_HAND_RATIO',
    name: 'Knee Outside Hand Ratio',
    category: 'Hips & Pelvis',
    min: -0.5,
    max: 1.0,
    step: 0.01,
    default_val: 0.15,
    dir: 'asc',
    desc: 'Lateral clearance of active knee relative to the planted hand in tabletop/quadruped, normalized to torso length (-0.5 to 1.0).\n\n' +
          '• In-line / Inside Hand: <= 0.00 (Knee remains tucked along sagittal line of hand).\n' +
          '• Fire Hydrant Clearance: >= 0.10 (Knee successfully breaks outward past the hand line).\n' +
          '• Full Abduction Range: 0.15 to 0.35 (~15 to 30 cm lateral clearance outside hand).\n' +
          '• Rest / Rep Finish: <= 0.05 (Knee returns back in line with hand to complete rep).'
  },
  {
    key: 'LEFT_KNEE_OUTSIDE_HAND_RATIO',
    name: 'Left Knee Outside Hand Ratio',
    category: 'Hips & Pelvis',
    min: -0.5,
    max: 1.0,
    step: 0.01,
    default_val: 0.15,
    dir: 'asc',
    desc: 'Lateral clearance of left knee relative to planted left hand in tabletop/quadruped, normalized to torso length (-0.5 to 1.0).'
  },
  {
    key: 'HIP_INTERNAL_ROTATION',
    name: 'Hip Internal Rotation Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 45,
    step: 1,
    default_val: 30,
    dir: 'asc',
    desc: 'Active rotation of femur inward toward midline with knee bent at 90° (shin swings laterally outward) (0°-45°). The #1 hip risk marker linked to lumbar disc herniation and SI joint overload.\n\n' +
          '• Beginner / Risk Screening: >= 20° (Critical cutoff: <20° forces lumbar spine rotation during walking and lifting).\n' +
          '• Intermediate / Functional Range: >= 30° (Normal healthy active internal rotation).\n' +
          '• Advanced / Athletic Capacity: >= 40° (High rotational capacity for golf, tennis, throwing, deep squatting).\n' +
          '• Form Check / Fault Alert: If paired with Pelvic Drop/Tilt > 15°, flags spinal twisting cheating the angle.'
  },
  {
    key: 'LEFT_HIP_INTERNAL_ROTATION',
    name: 'Left Hip Internal Rotation',
    category: 'Hips & Pelvis',
    min: 0,
    max: 45,
    step: 1,
    default_val: 30,
    dir: 'asc',
    desc: 'Active internal rotation of left femur with knee bent at 90° (0°-45°). Evaluates left hip capsule laxity and femoral neck clearance.\n\n' +
          '• Beginner / Risk Screening: >= 20°.\n' +
          '• Intermediate / Functional Range: >= 30°.\n' +
          '• Advanced / Athletic Capacity: >= 40°.\n' +
          '• Form Check / Fault Alert: Flag deficit if < 15°.'
  },
  {
    key: 'RIGHT_HIP_INTERNAL_ROTATION',
    name: 'Right Hip Internal Rotation',
    category: 'Hips & Pelvis',
    min: 0,
    max: 45,
    step: 1,
    default_val: 30,
    dir: 'asc',
    desc: 'Active internal rotation of right femur with knee bent at 90° (0°-45°). Evaluates right hip capsule laxity and femoral neck clearance.\n\n' +
          '• Beginner / Risk Screening: >= 20°.\n' +
          '• Intermediate / Functional Range: >= 30°.\n' +
          '• Advanced / Athletic Capacity: >= 40°.\n' +
          '• Form Check / Fault Alert: Flag deficit if < 15°.'
  },
  {
    key: 'HIP_EXTERNAL_ROTATION',
    name: 'Hip External Rotation Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 50,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: 'Active rotation of femur outward away from midline with knee bent at 90° (shin swings medially inward) (0°-50°). Audits piriformis/deep 6 rotators, groin flexibility, and knees-out squat mechanics.\n\n' +
          '• Beginner / Risk Screening: >= 25° (Minimum functional clearance for cross-legged sitting and safe squat descent).\n' +
          '• Intermediate / Functional Range: >= 35° (Standard functional capacity for running and lifting).\n' +
          '• Advanced / Athletic Capacity: >= 45° (Elite hip capsule mobility).\n' +
          '• Form Check / Fault Alert: Flag if knee angle drops < 70° (athlete extending knee to fake rotation).'
  },
  {
    key: 'LEFT_HIP_EXTERNAL_ROTATION',
    name: 'Left Hip External Rotation',
    category: 'Hips & Pelvis',
    min: 0,
    max: 50,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: 'Active external rotation of left femur with knee bent at 90° (0°-50°).\n\n' +
          '• Beginner / Risk Screening: >= 25°.\n' +
          '• Intermediate / Functional Range: >= 35°.\n' +
          '• Advanced / Athletic Capacity: >= 45°.\n' +
          '• Form Check / Fault Alert: Shin medial swing without knee flair > 20°.'
  },
  {
    key: 'RIGHT_HIP_EXTERNAL_ROTATION',
    name: 'Right Hip External Rotation',
    category: 'Hips & Pelvis',
    min: 0,
    max: 50,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: 'Active external rotation of right femur with knee bent at 90° (0°-50°).\n\n' +
          '• Beginner / Risk Screening: >= 25°.\n' +
          '• Intermediate / Functional Range: >= 35°.\n' +
          '• Advanced / Athletic Capacity: >= 45°.\n' +
          '• Form Check / Fault Alert: Shin medial swing without knee flair > 20°.'
  },
  {
    key: 'HIP_FLEXION',
    name: 'Hip Flexion Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 130,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Active anterior elevation of thigh relative to vertical standing posture (0°-130°). Measures iliopsoas/rectus femoris capacity and anterior hip mobility in both front and sagittal views.\n\n' +
          '• Standing Rest / Lockout: <= 20° (Leg straight down on the floor).\n' +
          '• Half Lift: 40° to 60° (Partial knee elevation).\n' +
          '• 90° Horizontal Thigh: >= 75° to 90° (Standard target for standing hip rotations and march assessments).\n' +
          '• High Knee / Deep Flexion: >= 100° to 120° (Deep athletic knee drive).'
  },
  {
    key: 'LEFT_HIP_FLEXION',
    name: 'Left Hip Flexion',
    category: 'Hips & Pelvis',
    min: 0,
    max: 130,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Active anterior elevation and lift of left thigh from vertical standing posture (0°-130°).\n\n' +
          '• Standing Rest: <= 20°.\n' +
          '• Target Lift (90°): >= 75°.\n' +
          '• Active Hold Threshold: >= 60°.'
  },
  {
    key: 'RIGHT_HIP_FLEXION',
    name: 'Right Hip Flexion',
    category: 'Hips & Pelvis',
    min: 0,
    max: 130,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Active anterior elevation and lift of right thigh from vertical standing posture (0°-130°).\n\n' +
          '• Standing Rest: <= 20°.\n' +
          '• Target Lift (90°): >= 75°.\n' +
          '• Active Hold Threshold: >= 60°.'
  },
  {
    key: 'HIP_EXTENSION',
    name: 'Hip Extension Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 60,
    step: 1,
    default_val: 30,
    dir: 'asc',
    desc: 'Active posterior reach and extension of thigh backward from vertical standing posture in sagittal view (0°-60°). Audits gluteus maximus engagement and psoas/anterior hip capsule length.\n\n' +
          '• Standing Rest / Lockout: <= 10° (Leg straight down).\n' +
          '• Beginner / Risk Screening: >= 15° (Basic hip clearance without excessive lumbar lordosis).\n' +
          '• Intermediate / Functional Range: >= 30° (Healthy stride extension and athletic hip power).\n' +
          '• Advanced / Athletic Capacity: >= 45° (Sprinter / dancer sagittal hip clearance).'
  },
  {
    key: 'LEFT_HIP_EXTENSION',
    name: 'Left Hip Extension',
    category: 'Hips & Pelvis',
    min: 0,
    max: 60,
    step: 1,
    default_val: 30,
    dir: 'asc',
    desc: 'Active posterior extension of left thigh backward from vertical standing posture (0°-60°).\n\n' +
          '• Standing Rest: <= 10°.\n' +
          '• Target Extension: >= 30°.\n' +
          '• Active Hold Threshold: >= 15°.'
  },
  {
    key: 'RIGHT_HIP_EXTENSION',
    name: 'Right Hip Extension',
    category: 'Hips & Pelvis',
    min: 0,
    max: 60,
    step: 1,
    default_val: 30,
    dir: 'asc',
    desc: 'Active posterior extension of right thigh backward from vertical standing posture (0°-60°).\n\n' +
          '• Standing Rest: <= 10°.\n' +
          '• Target Extension: >= 30°.\n' +
          '• Active Hold Threshold: >= 15°.'
  },
  {
    key: 'HIP_HINGE_ANGLE',
    name: 'Hip Hinge Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Interior sagittal angle formed by Shoulder, Hip, and Knee (0°-180°). Distinguishes true hip flexion from lumbar spinal flexion in deadlifts, RDLs, and quadruped positions.\n\n' +
          '• Beginner / Risk Screening: <= 115° (Demonstrates fundamental hinge mechanics; standing lockout >= 165°).\n' +
          '• Intermediate / Functional Range: <= 90° (True 90° horizontal tabletop hinge with neutral lumbar lordosis).\n' +
          '• Advanced / Athletic Capacity: <= 65° (Deep hinge for heavy deadlifts, kettlebell swings, and cleans).\n' +
          '• Form Check / Fault Alert: If Hinge < 80° but Dynamic Torso Compression < 0.88, athlete is rounding lower back.'
  },
  {
    key: 'LEFT_HIP_HINGE_ANGLE',
    name: 'Left Hip Hinge Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Left-side interior sagittal angle between Left Shoulder, Left Hip, and Left Knee (0°-180°).\n\n' +
          '• Beginner / Risk Screening: <= 115° (Standing lockout >= 165°).\n' +
          '• Intermediate / Functional Range: <= 90°.\n' +
          '• Advanced / Athletic Capacity: <= 65°.\n' +
          '• Form Check / Fault Alert: Check bilateral symmetry difference > 15°.'
  },
  {
    key: 'RIGHT_HIP_HINGE_ANGLE',
    name: 'Right Hip Hinge Angle',
    category: 'Hips & Pelvis',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Right-side interior sagittal angle between Right Shoulder, Right Hip, and Right Knee (0°-180°).\n\n' +
          '• Beginner / Risk Screening: <= 115° (Standing lockout >= 165°).\n' +
          '• Intermediate / Functional Range: <= 90°.\n' +
          '• Advanced / Athletic Capacity: <= 65°.\n' +
          '• Form Check / Fault Alert: Check bilateral symmetry difference > 15°.'
  },

  // ==========================================
  // 2. SPINE, TRUNK & CORE STABILITY
  // ==========================================
  {
    key: 'THORACOLUMBAR_ROTATION',
    name: 'Thoracolumbar Spine Rotation',
    category: 'Spine & Trunk',
    min: 0,
    max: 60,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: '3D transverse yaw dissociation angle between biacromial shoulder line and pelvic inter-ASIS line (0°-60°). The clinical gold-standard audit for thoracic rotation without lumbar shearing.\n\n' +
          '• Beginner / Risk Screening: >= 25° (Essential occupational turning; <20° forces dangerous lumbar facet joint twisting).\n' +
          '• Intermediate / Functional Range: >= 35° (Normal healthy thoracic mobility with stable hips).\n' +
          '• Advanced / Athletic Capacity: >= 45° (High rotational power for striking, throwing, swimming, golf swing).\n' +
          '• Form Check / Fault Alert: In isolated hip CARs or bridges: <= 20° (alerts if athlete twists torso to fake joint range).'
  },
  {
    key: 'SPINE_FLEXION',
    name: 'Spine Sagittal Flexion',
    category: 'Spine & Trunk',
    min: 0,
    max: 75,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: 'Active forward rounding and sagittal flexion of thoracic and lumbar spine relative to vertical standing posture (0°-75°). Audits spinal disc decompression, paraspinal mobility, and segmental flexion capacity without hip hinge compensation.\n\n' +
          '• Standing Neutral: <= 10° (Upright spinal alignment).\n' +
          '• Beginner / Risk Screening: >= 25° (Basic functional forward spinal curling).\n' +
          '• Intermediate / Functional Range: >= 38° (Healthy full-range thoracic/lumbar flexion).\n' +
          '• Advanced / Athletic Capacity: >= 50° (Gymnast / martial artist deep spinal flexion).\n' +
          '• Form Check / Fault Alert: If Hip Hinge Angle < 160°, athlete is bending at the waist/hips instead of flexing spine.'
  },
  {
    key: 'SPINE_EXTENSION',
    name: 'Spine Sagittal Extension',
    category: 'Spine & Trunk',
    min: 0,
    max: 60,
    step: 1,
    default_val: 25,
    dir: 'asc',
    desc: 'Active backward arching and sagittal extension of thoracic and lumbar spine relative to vertical standing posture (0°-60°). Audits anterior longitudinal ligament length, rectus abdominis compliance, and thoracic extension capacity.\n\n' +
          '• Standing Neutral: <= 8°.\n' +
          '• Beginner / Risk Screening: >= 15° (Minimal extension to counter sedentary kyphosis).\n' +
          '• Intermediate / Functional Range: >= 25° (Healthy thoracic extension for overhead lifting and posture).\n' +
          '• Advanced / Athletic Capacity: >= 38° (High-level backbridge / gymnastics arching).\n' +
          '• Form Check / Fault Alert: If Hip Hinge Angle < 160° or pelvic sway > 0.10, athlete is thrusting hips instead of extending spine.'
  },
  {
    key: 'SPINE_LATERAL_FLEXION',
    name: 'Spine Lateral Flexion Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 45,
    step: 1,
    default_val: 25,
    dir: 'asc',
    desc: 'Coronal side-bend angle of mid-shoulder to mid-hip vector relative to true vertical (0°-45°). Audits quadratus lumborum tightness, unilateral disc compression, and functional scoliosis.\n\n' +
          '• Beginner / Risk Screening: >= 20° (Adequate side clearance without compensatory hip hiking).\n' +
          '• Intermediate / Functional Range: >= 30° (Symmetric bilateral lateral flexion).\n' +
          '• Advanced / Athletic Capacity: >= 38° (High-level athletic lateral trunk mobility).\n' +
          '• Form Check / Fault Alert: Under bilateral load (squat, press, deadlift): <= 6° (flags spinal lateral tilt under load).'
  },
  {
    key: 'PELVIC_DROP_ANGLE',
    name: 'Pelvic Drop (Trendelenburg Angle)',
    category: 'Spine & Trunk',
    min: 0,
    max: 30,
    step: 1,
    default_val: 5,
    dir: 'desc',
    desc: 'Angular tilt of inter-hip line from horizontal during single-leg stance or dynamic locomotion (0°-30°). Direct audit of contralateral gluteus medius strength and pelvic stability.\n\n' +
          '• Beginner / Risk Screening: < 8° (Mild tilt acceptable; >10° indicates positive Trendelenburg sign, high fall/knee risk).\n' +
          '• Intermediate / Functional Range: < 5° (Healthy level pelvis during running, stairs, single-leg deadlifts).\n' +
          '• Advanced / Athletic Capacity: < 3° (Locked horizontal pelvic stability under heavy unilateral loads).\n' +
          '• Form Check / Fault Alert: Trigger voice cue "Level your hips!" if > 8°.'
  },
  {
    key: 'TORSO_ANGLE_VERT',
    name: 'Torso Angle (Vertical Deviation)',
    category: 'Spine & Trunk',
    min: 0,
    max: 90,
    step: 1,
    default_val: 25,
    dir: 'asc',
    desc: 'Torso lean angle relative to true gravity vertical (0°-90°). Classifies posture: 0°-10° standing, 80°-95° quadruped all-fours.\n\n' +
          '• Beginner / Risk Screening: In Squats: <= 45° (Excessive forward pitch flags weak glutes or tight ankles).\n' +
          '• Intermediate / Functional Range: In Squats: <= 30°. Standing Lock: <= 8°.\n' +
          '• Advanced / Athletic Capacity: In Squats: <= 18° (High-bar Olympic verticality).\n' +
          '• Form Check / Fault Alert: In Tabletop/Quadruped: >= 75° (ensures flat back, no sitting on heels). In Squats: > 48° warns "Keep chest up!".'
  },
  {
    key: 'DYN_TORSO_COMPRESSION',
    name: 'Dynamic Torso Compression Ratio',
    category: 'Spine & Trunk',
    min: 0.1,
    max: 1.0,
    step: 0.01,
    default_val: 0.95,
    dir: 'asc',
    desc: 'Real-time ratio of instantaneous torso height vs calibrated standing baseline (0.1-1.0). Detects spinal flexion, buckling under load, or "butt wink".\n\n' +
          '• Beginner / Risk Screening: >= 0.85 (Permits mild spinal curvature during initial conditioning).\n' +
          '• Intermediate / Functional Range: >= 0.92 (Maintains rigid spinal column throughout full movement).\n' +
          '• Advanced / Athletic Capacity: >= 0.97 (Zero axial torso collapsing even in deep squat hole).\n' +
          '• Form Check / Fault Alert: Trigger voice cue "Don\'t round your back!" if ratio drops < 0.88.'
  },
  {
    key: 'CERVICAL_SPINE_ALIGNMENT',
    name: 'Cervical Spine Alignment Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 180,
    step: 1,
    default_val: 170,
    dir: 'asc',
    desc: 'Cervicothoracic alignment angle formed by Ear -> Shoulder -> Hip (0°-180°). Audits head-neck packing, craniocervical flexion, and detects forward head jutting / hyperextension.\n\n' +
          '• Beginner / Risk Screening: >= 140° (Prevents excessive cervical spine strain and turtle-necking).\n' +
          '• Intermediate / Functional Range: >= 160° (Neutral head packed in alignment with thoracic spine).\n' +
          '• Advanced / Athletic Capacity: >= 170° (Flawless neutral cervical alignment under dynamic load).\n' +
          '• Form Check / Fault Alert: Trigger voice cue "Keep your neck aligned with your spine!" if angle drops < 140° during flexion or hyperextends.'
  },

  // ==========================================
  // 3. SHOULDER GIRDLE & SCAPULOTHORACIC
  // ==========================================
  {
    key: 'SHOULDER_FLEXION',
    name: 'Shoulder Flexion Angle',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 180,
    step: 1,
    default_val: 165,
    dir: 'asc',
    desc: 'Bilateral arm elevation moving forward and upward in sagittal plane (0°-180°). Audits latissimus dorsi length, thoracic extension, and safe overhead clearance.\n\n' +
          '• Beginner / Risk Screening: >= 140° (Minimum functional overhead reach; <130° forces excessive lumbar hyperextension).\n' +
          '• Intermediate / Functional Range: >= 165° (Standard healthy full overhead elevation).\n' +
          '• Advanced / Athletic Capacity: >= 175° (Complete 180° vertical lockout for Olympic lifting, snatches, gymnastics).\n' +
          '• Form Check / Fault Alert: In Quadruped Tabletop Setup: <= 90° (arms perpendicular to floor). If >165° with Torso Vertical > 15°, athlete is arching lumbar spine.'
  },
  {
    key: 'LEFT_SHOULDER_FLEXION',
    name: 'Left Shoulder Flexion',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 180,
    step: 1,
    default_val: 165,
    dir: 'asc',
    desc: 'Left arm elevation moving forward and overhead in sagittal plane (0°-180°).\n\n' +
          '• Beginner / Risk Screening: >= 140° (Setup lock <= 90°).\n' +
          '• Intermediate / Functional Range: >= 165°.\n' +
          '• Advanced / Athletic Capacity: >= 175°.\n' +
          '• Form Check / Fault Alert: Bilateral asymmetry deficit > 15° flags unilateral lat tightness.'
  },
  {
    key: 'RIGHT_SHOULDER_FLEXION',
    name: 'Right Shoulder Flexion',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 180,
    step: 1,
    default_val: 165,
    dir: 'asc',
    desc: 'Right arm elevation moving forward and overhead in sagittal plane (0°-180°).\n\n' +
          '• Beginner / Risk Screening: >= 140° (Setup lock <= 90°).\n' +
          '• Intermediate / Functional Range: >= 165°.\n' +
          '• Advanced / Athletic Capacity: >= 175°.\n' +
          '• Form Check / Fault Alert: Bilateral asymmetry deficit > 15° flags unilateral lat tightness.'
  },
  {
    key: 'SHOULDER_EXTENSION',
    name: 'Shoulder Extension Angle',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 50,
    dir: 'asc',
    desc: 'Backward reach angle of arm behind the torso in the sagittal plane (0°-90°). Audits posterior deltoid, latissimus dorsi, and anterior shoulder capsule flexibility.\n\n' +
          '• Beginner / Risk Screening: >= 35° (Basic functional reach behind back).\n' +
          '• Intermediate / Functional Range: >= 50° (Healthy athletic extension; reaches 50°-60°).\n' +
          '• Advanced / Athletic Capacity: >= 65° (Elite extension capacity without forward torso pitch).\n' +
          '• Form Check / Fault Alert: Trigger "Do not lean forward to cheat range!" if Torso Angle > 8°.'
  },
  {
    key: 'LEFT_SHOULDER_EXTENSION',
    name: 'Left Shoulder Extension',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 50,
    dir: 'asc',
    desc: 'Left arm backward reach angle behind torso in sagittal plane (0°-90°).\n\n' +
          '• Beginner: >= 35°.\n' +
          '• Intermediate: >= 50°.\n' +
          '• Advanced: >= 65°.'
  },
  {
    key: 'RIGHT_SHOULDER_EXTENSION',
    name: 'Right Shoulder Extension',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 50,
    dir: 'asc',
    desc: 'Right arm backward reach angle behind torso in sagittal plane (0°-90°).\n\n' +
          '• Beginner: >= 35°.\n' +
          '• Intermediate: >= 50°.\n' +
          '• Advanced: >= 65°.'
  },
  {
    key: 'SHOULDER_ABDUCTION_ANGLE',
    name: 'Shoulder Abduction Angle',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 180,
    step: 1,
    default_val: 160,
    dir: 'asc',
    desc: 'Bilateral lateral raise of arm outward in coronal/frontal plane (0°-180°). Audits supraspinatus/deltoid capacity and subacromial space clearance.\n\n' +
          '• Beginner / Risk Screening: >= 135° (Adequate for daily reaching; <120° indicates adhesive capsulitis or impingement).\n' +
          '• Intermediate / Functional Range: >= 160° (Full coronal abduction).\n' +
          '• Advanced / Athletic Capacity: >= 175° (Biceps touch ears in pure frontal plane without shrugging).\n' +
          '• Form Check / Fault Alert: Scapular Elevation Ratio must stay <= 1.20 during abduction.'
  },
  {
    key: 'LEFT_SHOULDER_ABDUCTION',
    name: 'Left Shoulder Abduction',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 180,
    step: 1,
    default_val: 160,
    dir: 'asc',
    desc: 'Left arm lateral coronal raise away from torso (0°-180°).\n\n' +
          '• Beginner / Risk Screening: >= 135°.\n' +
          '• Intermediate / Functional Range: >= 160°.\n' +
          '• Advanced / Athletic Capacity: >= 175°.\n' +
          '• Form Check / Fault Alert: Flag if left trap shrugs prematurely.'
  },
  {
    key: 'RIGHT_SHOULDER_ABDUCTION',
    name: 'Right Shoulder Abduction',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 180,
    step: 1,
    default_val: 160,
    dir: 'asc',
    desc: 'Right arm lateral coronal raise away from torso (0°-180°).\n\n' +
          '• Beginner / Risk Screening: >= 135°.\n' +
          '• Intermediate / Functional Range: >= 160°.\n' +
          '• Advanced / Athletic Capacity: >= 175°.\n' +
          '• Form Check / Fault Alert: Flag if right trap shrugs prematurely.'
  },
  {
    key: 'SHOULDER_EXTERNAL_ROTATION',
    name: 'Shoulder External Rotation Angle',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 75,
    dir: 'asc',
    desc: 'Upward/backward rotation of forearm with elbow abducted at 90° (high-five or throwing preparation position) (0°-90°). Rotator cuff (infraspinatus & teres minor) health benchmark.\n\n' +
          '• Beginner / Risk Screening: >= 60° (Minimum capacity for safe overhead squats and posture).\n' +
          '• Intermediate / Functional Range: >= 75° (Normal healthy active external rotation).\n' +
          '• Advanced / Athletic Capacity: >= 85° (High capacity for throwing athletes, volleyball, swimming).\n' +
          '• Form Check / Fault Alert: Flag if Scapular Elevation Ratio > 1.25 (shrugging to fake external rotation).'
  },
  {
    key: 'LEFT_SHOULDER_EXTERNAL_ROTATION',
    name: 'Left Shoulder External Rotation',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 75,
    dir: 'asc',
    desc: 'Left arm external rotation with elbow abducted at 90° (0°-90°).\n\n' +
          '• Beginner / Risk Screening: >= 60°.\n' +
          '• Intermediate / Functional Range: >= 75°.\n' +
          '• Advanced / Athletic Capacity: >= 85°.'
  },
  {
    key: 'RIGHT_SHOULDER_EXTERNAL_ROTATION',
    name: 'Right Shoulder External Rotation',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 75,
    dir: 'asc',
    desc: 'Right arm external rotation with elbow abducted at 90° (0°-90°).\n\n' +
          '• Beginner / Risk Screening: >= 60°.\n' +
          '• Intermediate / Functional Range: >= 75°.\n' +
          '• Advanced / Athletic Capacity: >= 85°.'
  },
  {
    key: 'SHOULDER_INTERNAL_ROTATION',
    name: 'Shoulder Internal Rotation Angle',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 70,
    step: 1,
    default_val: 60,
    dir: 'asc',
    desc: 'Downward/forward rotation of forearm with elbow abducted at 90° (0°-70°). Audits subscapularis flexibility, posterior capsule tightness, and internal impingement (GIRD).\n\n' +
          '• Beginner / Risk Screening: >= 45° (Deficit <40° is primary precursor to anterior labrum stress and impingement).\n' +
          '• Intermediate / Functional Range: >= 60° (Healthy functional internal rotation).\n' +
          '• Advanced / Athletic Capacity: >= 70° (Elite overhead athlete capsule capacity).\n' +
          '• Form Check / Fault Alert: Flag if anterior shoulder tilts forward (scapular anterior dump).'
  },
  {
    key: 'LEFT_SHOULDER_INTERNAL_ROTATION',
    name: 'Left Shoulder Internal Rotation',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 70,
    step: 1,
    default_val: 60,
    dir: 'asc',
    desc: 'Left arm internal rotation with elbow abducted at 90° (0°-70°).\n\n' +
          '• Beginner / Risk Screening: >= 45°.\n' +
          '• Intermediate / Functional Range: >= 60°.\n' +
          '• Advanced / Athletic Capacity: >= 70°.'
  },
  {
    key: 'RIGHT_SHOULDER_INTERNAL_ROTATION',
    name: 'Right Shoulder Internal Rotation',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 70,
    step: 1,
    default_val: 60,
    dir: 'asc',
    desc: 'Right arm internal rotation with elbow abducted at 90° (0°-70°).\n\n' +
          '• Beginner / Risk Screening: >= 45°.\n' +
          '• Intermediate / Functional Range: >= 60°.\n' +
          '• Advanced / Athletic Capacity: >= 70°.'
  },
  {
    key: 'SCAPULAR_ELEVATION_RATIO',
    name: 'Scapular Elevation Ratio',
    category: 'Shoulders & Scapula',
    min: 0.5,
    max: 2.0,
    step: 0.05,
    default_val: 1.0,
    dir: 'desc',
    desc: 'Ratio of current ear-to-shoulder vertical distance vs resting calibrated distance (0.5-2.0). Quantifies upper-trapezius shrugging compensation during arm raises and squats.\n\n' +
          '• Beginner / Risk Screening: <= 1.25 (Permits mild neck tension during exertion).\n' +
          '• Intermediate / Functional Range: <= 1.10 (Clean scapular depression with calm upper traps).\n' +
          '• Advanced / Athletic Capacity: <= 1.02 (Zero shrugging compensation through complete 180° range).\n' +
          '• Form Check / Fault Alert: Trigger voice cue "Drop your shoulders away from your ears!" if > 1.25.'
  },
  {
    key: 'SHOULDER_ROTATION',
    name: 'Shoulder Twist / Yaw Rotation',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 15,
    dir: 'desc',
    desc: 'Absolute horizontal yaw twist of biacromial shoulder line relative to setup plane (0°-90°).\n\n' +
          '• Beginner / Risk Screening: <= 30° (Acceptable torso rotation in compound movements).\n' +
          '• Intermediate / Functional Range: <= 20° (Good extremity isolation without trunk twisting).\n' +
          '• Advanced / Athletic Capacity: <= 10° (Pure joint isolation without rotational compensation).\n' +
          '• Form Check / Fault Alert: In CARs form checks: <= 25° (warns "Don\'t twist your chest!").'
  },
  {
    key: 'SHOULDER_ROTATION_LEFT',
    name: 'Shoulder Twist / Yaw Rotation (Left)',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 20,
    dir: 'desc',
    desc: 'Horizontal yaw rotation of biacromial shoulder line specifically to the LEFT direction (0°-90°). Combines 2D pixel width for precise degrees with 3D depth to isolate leftward torso twists.\n\n' +
          '• Beginner / Target Trigger: >= 30° (Deep leftward torso rotation clearance).\n' +
          '• Intermediate / Functional Range: >= 20° (Controlled leftward trunk rotation).\n' +
          '• Advanced / Isolation Goal: >= 15° (Strict leftward spinal twist).\n' +
          '• Exit Condition Usage: Use in exit rules for Left Twist phases (e.g., SHOULDER_ROTATION_LEFT >= 20°).'
  },
  {
    key: 'SHOULDER_ROTATION_RIGHT',
    name: 'Shoulder Twist / Yaw Rotation (Right)',
    category: 'Shoulders & Scapula',
    min: 0,
    max: 90,
    step: 1,
    default_val: 20,
    dir: 'desc',
    desc: 'Horizontal yaw rotation of biacromial shoulder line specifically to the RIGHT direction (0°-90°). Combines 2D pixel width for precise degrees with 3D depth to isolate rightward torso twists.\n\n' +
          '• Beginner / Target Trigger: >= 30° (Deep rightward torso rotation clearance).\n' +
          '• Intermediate / Functional Range: >= 20° (Controlled rightward trunk rotation).\n' +
          '• Advanced / Isolation Goal: >= 15° (Strict rightward spinal twist).\n' +
          '• Exit Condition Usage: Use in exit rules for Right Twist phases (e.g., SHOULDER_ROTATION_RIGHT >= 20°).'
  },

  // ==========================================
  // 4. KNEE COMPLEX
  // ==========================================
  {
    key: 'KNEE_ANGLE',
    name: 'Knee Angle (Flexion/Extension)',
    category: 'Knees & Legs',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Interior sagittal angle formed by Hip, Knee, and Ankle (0°-180°). 180° = straight standing leg; 90° = parallel squat; 65° = deep ass-to-grass.\n\n' +
          '• Beginner / Risk Screening: Squat Depth: <= 100° (Half squat clearance). Extension Lock: >= 165°.\n' +
          '• Intermediate / Functional Range: Squat Depth: <= 85° (Below parallel squat). Extension Lock: >= 175°.\n' +
          '• Advanced / Athletic Capacity: Squat Depth: <= 65° (Full Olympic deep squat).\n' +
          '• Form Check / Fault Alert: Standing setup: < 160° warns "Lock out your knees!". In Quadruped Setup: >= 75° ensures knee is grounded.'
  },
  {
    key: 'LEFT_KNEE_ANGLE',
    name: 'Left Knee Angle',
    category: 'Knees & Legs',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Left knee flexion/extension angle (0°-180°).\n\n' +
          '• Beginner / Risk Screening: Squat <= 100°, Lockout >= 165°.\n' +
          '• Intermediate / Functional Range: Squat <= 85°, Lockout >= 175°.\n' +
          '• Advanced / Athletic Capacity: Squat <= 65°.\n' +
          '• Form Check / Fault Alert: Quadruped Grounded Knee >= 75°.'
  },
  {
    key: 'RIGHT_KNEE_ANGLE',
    name: 'Right Knee Angle',
    category: 'Knees & Legs',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Right knee flexion/extension angle (0°-180°).\n\n' +
          '• Beginner / Risk Screening: Squat <= 100°, Lockout >= 165°.\n' +
          '• Intermediate / Functional Range: Squat <= 85°, Lockout >= 175°.\n' +
          '• Advanced / Athletic Capacity: Squat <= 65°.\n' +
          '• Form Check / Fault Alert: Quadruped Grounded Knee >= 75°.'
  },
  {
    key: 'KNEE_VALGUS_RATIO',
    name: 'Knee Valgus / Cave Ratio',
    category: 'Knees & Legs',
    min: 0.5,
    max: 1.5,
    step: 0.05,
    default_val: 1.0,
    dir: 'asc',
    desc: 'Ratio of inter-knee horizontal distance divided by inter-ankle distance (0.5-1.5). The #1 clinical metric for ACL tear risk and medial meniscus shear.\n\n' +
          '• Beginner / Risk Screening: >= 0.82 (Minor knee cave permitted; <0.75 is immediate red-flag ACL risk).\n' +
          '• Intermediate / Functional Range: >= 0.92 (Knees track directly in line with 2nd toe).\n' +
          '• Advanced / Athletic Capacity: >= 1.05 (Active glute-driven knee flare/push outward).\n' +
          '• Form Check / Fault Alert: Trigger voice cue "Push your knees out!" if < 0.85.'
  },
  {
    key: 'KNEE_OVER_TOE',
    name: 'Knee Over Toe Distance',
    category: 'Knees & Legs',
    min: -20,
    max: 50,
    step: 1,
    default_val: 10,
    dir: 'desc',
    desc: 'Horizontal translation distance of patella past the vertical toe line in sagittal plane (cm/normalized units).\n\n' +
          '• Beginner / Risk Screening: <= 20 (Acceptable forward translation with flat heels).\n' +
          '• Intermediate / Functional Range: <= 12 (Balanced quad and posterior-chain loading).\n' +
          '• Advanced / Athletic Capacity: <= 5 (Low patellar shear; or up to 25 in ATG split squats with full dorsiflexion).\n' +
          '• Form Check / Fault Alert: If paired with Heel Raise Tilt > 15°, warns "Keep heels on the floor!".'
  },

  // ==========================================
  // 5. ANKLE & FOOT COMPLEX
  // ==========================================
  {
    key: 'ANKLE_DORSIFLEXION_ANGLE',
    name: 'Ankle Dorsiflexion Angle',
    category: 'Ankles & Feet',
    min: 0,
    max: 45,
    step: 1,
    default_val: 32,
    dir: 'asc',
    desc: 'Forward pitch angle of tibia past 90° vertical with heel grounded (0°-45°). Closed-chain mobility audit governing deep squat depth and running mechanics.\n\n' +
          '• Beginner / Risk Screening: >= 22° (Restricted mobility; <20° causes foot pronation, knee valgus, and lumbar flexion).\n' +
          '• Intermediate / Functional Range: >= 32° (Healthy closed-chain dorsiflexion; passes knee-to-wall test).\n' +
          '• Advanced / Athletic Capacity: >= 40° (Elite Olympic lifting and sprinting ankle mobility).\n' +
          '• Form Check / Fault Alert: Flag if heel lifts off floor during dorsiflexion attempt.'
  },
  {
    key: 'LEFT_ANKLE_DORSIFLEXION',
    name: 'Left Ankle Dorsiflexion',
    category: 'Ankles & Feet',
    min: 0,
    max: 45,
    step: 1,
    default_val: 32,
    dir: 'asc',
    desc: 'Forward pitch angle of left tibia over left foot with heel grounded (0°-45°).\n\n' +
          '• Beginner / Risk Screening: >= 22°.\n' +
          '• Intermediate / Functional Range: >= 32°.\n' +
          '• Advanced / Athletic Capacity: >= 40°.'
  },
  {
    key: 'RIGHT_ANKLE_DORSIFLEXION',
    name: 'Right Ankle Dorsiflexion',
    category: 'Ankles & Feet',
    min: 0,
    max: 45,
    step: 1,
    default_val: 32,
    dir: 'asc',
    desc: 'Forward pitch angle of right tibia over right foot with heel grounded (0°-45°).\n\n' +
          '• Beginner / Risk Screening: >= 22°.\n' +
          '• Intermediate / Functional Range: >= 32°.\n' +
          '• Advanced / Athletic Capacity: >= 40°.'
  },
  {
    key: 'HEEL_RAISE_TILT',
    name: 'Heel Raise Tilt Angle',
    category: 'Ankles & Feet',
    min: 0,
    max: 90,
    step: 1,
    default_val: 45,
    dir: 'asc',
    desc: 'Plantarflexion lift angle of heel relative to toe index (0°-90°). Measures calf raise extension and detects premature heel lift in squats.\n\n' +
          '• Beginner / Risk Screening: Calf Raise: >= 30°. Squat Form Check: <= 8°.\n' +
          '• Intermediate / Functional Range: Calf Raise: >= 45°. Squat Form Check: <= 4°.\n' +
          '• Advanced / Athletic Capacity: Calf Raise: >= 60° (Full tiptoe triple extension). Squat Form Check: 0°.\n' +
          '• Form Check / Fault Alert: In squats/deadlifts, trigger "Keep your heels down!" if > 8°.'
  },
  {
    key: 'LEFT_HEEL_RAISE_TILT',
    name: 'Left Heel Raise Tilt',
    category: 'Ankles & Feet',
    min: 0,
    max: 90,
    step: 1,
    default_val: 45,
    dir: 'asc',
    desc: 'Left foot heel raise angle (0°-90°).\n\n' +
          '• Beginner: Calf Raise >= 30° (Squat <= 8°).\n' +
          '• Intermediate: >= 45°.\n' +
          '• Advanced: >= 60°.'
  },
  {
    key: 'RIGHT_HEEL_RAISE_TILT',
    name: 'Right Heel Raise Tilt',
    category: 'Ankles & Feet',
    min: 0,
    max: 90,
    step: 1,
    default_val: 45,
    dir: 'asc',
    desc: 'Right foot heel raise angle (0°-90°).\n\n' +
          '• Beginner: Calf Raise >= 30° (Squat <= 8°).\n' +
          '• Intermediate: >= 45°.\n' +
          '• Advanced: >= 60°.'
  },
  {
    key: 'FOOT_TURNOUT_ANGLE',
    name: 'Foot Turnout Angle (Duck Foot)',
    category: 'Ankles & Feet',
    min: 0,
    max: 60,
    step: 1,
    default_val: 15,
    dir: 'asc',
    desc: 'Outward flare angle of feet from forward line (0°-60°). Audits tibial torsion, arch collapse, and stance setup.\n\n' +
          '• Beginner / Risk Screening: 10° - 35° (Accommodating stance; >40° flags compensation for zero ankle dorsiflexion).\n' +
          '• Intermediate / Functional Range: 12° - 25° (Standard biomechanical squat setup).\n' +
          '• Advanced / Athletic Capacity: 5° - 18° (Tight athletic tracking for sprinting and Olympic lifting).\n' +
          '• Form Check / Fault Alert: Trigger "Straighten your feet forward!" if > 38°.'
  },

  // ==========================================
  // 6. ELBOW, WRIST & PALM TRACKING
  // ==========================================
  {
    key: 'ELBOW_ANGLE',
    name: 'Elbow Angle (Flexion/Extension)',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Interior angle between Shoulder, Elbow, and Wrist (0°-180°). 180° = locked arm; 90° = right angle; 35° = full bicep curl.\n\n' +
          '• Beginner / Risk Screening: Pushup Bottom: <= 95°. Bicep Curl Peak: <= 60°. Lockout: >= 165°.\n' +
          '• Intermediate / Functional Range: Pushup Bottom: <= 85°. Bicep Curl Peak: <= 45°. Lockout: >= 175°.\n' +
          '• Advanced / Athletic Capacity: Pushup/Dip Bottom: <= 70°. Bicep Curl: <= 35°. Lockout: 180°.\n' +
          '• Form Check / Fault Alert: In planks or arm-supported CARs: < 160° flags sagging elbows.'
  },
  {
    key: 'LEFT_ELBOW_ANGLE',
    name: 'Left Elbow Angle',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Left arm interior elbow angle (0°-180°).\n\n' +
          '• Beginner: Flexion <= 60°, Lockout >= 165°.\n' +
          '• Intermediate: <= 45° / >= 175°.\n' +
          '• Advanced: <= 35° / 180°.'
  },
  {
    key: 'RIGHT_ELBOW_ANGLE',
    name: 'Right Elbow Angle',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 90,
    dir: 'asc',
    desc: 'Right arm interior elbow angle (0°-180°).\n\n' +
          '• Beginner: Flexion <= 60°, Lockout >= 165°.\n' +
          '• Intermediate: <= 45° / >= 175°.\n' +
          '• Advanced: <= 35° / 180°.'
  },
  {
    key: 'WRIST_ALIGNMENT',
    name: 'Wrist Alignment Angle',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 175,
    dir: 'asc',
    desc: 'Angle formed by Elbow, Wrist, and Index knuckle (0°-180°). 170°-180° = neutral wrist; <150° = collapsed wrist under load.\n\n' +
          '• Beginner / Risk Screening: >= 150° (Prevents acute carpal hyperextension sprain).\n' +
          '• Intermediate / Functional Range: >= 165° (Solid neutral wrist in bench press, pushups, overhead press).\n' +
          '• Advanced / Athletic Capacity: >= 175° (Zero wrist extension breakdown under maximal loading).\n' +
          '• Form Check / Fault Alert: Trigger voice cue "Keep your wrists straight!" if < 150°.'
  },
  {
    key: 'LEFT_WRIST_ALIGNMENT',
    name: 'Left Wrist Alignment',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 175,
    dir: 'asc',
    desc: 'Left wrist neutral alignment angle (0°-180°).\n\n' +
          '• Beginner: >= 150°.\n' +
          '• Intermediate: >= 165°.\n' +
          '• Advanced: >= 175°.'
  },
  {
    key: 'RIGHT_WRIST_ALIGNMENT',
    name: 'Right Wrist Alignment',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 175,
    dir: 'asc',
    desc: 'Right wrist neutral alignment angle (0°-180°).\n\n' +
          '• Beginner: >= 150°.\n' +
          '• Intermediate: >= 165°.\n' +
          '• Advanced: >= 175°.'
  },
  {
    key: 'WRIST_CHEST_CROSSING',
    name: 'Wrist Chest Crossing Score',
    category: 'Arms & Hands',
    min: 0,
    max: 100,
    step: 1,
    default_val: 70,
    dir: 'asc',
    desc: 'Adduction proximity percentage of wrist relative to sternal chest midline (0-100%). 100% = directly at sternum; 50% = at shoulder edge; 0% = outside body. Key entry marker for Shoulder CARs Phase 1.\n\n' +
          '• Beginner / Risk Screening: >= 50% (Brings arm across to opposite shoulder line).\n' +
          '• Intermediate / Functional Range: >= 70% (Clean adduction across chest midline).\n' +
          '• Advanced / Athletic Capacity: >= 88% (Deep cross-body adduction stretching posterior capsule).\n' +
          '• Form Check / Fault Alert: In CARs Phase 1 entry: < 50% flags arm swinging wide instead of across chest.'
  },
  {
    key: 'LEFT_WRIST_CHEST_CROSSING',
    name: 'Left Wrist Chest Crossing',
    category: 'Arms & Hands',
    min: 0,
    max: 100,
    step: 1,
    default_val: 70,
    dir: 'asc',
    desc: 'Left wrist adduction score relative to sternal chest midline (0-100%).\n\n' +
          '• Beginner / Risk Screening: >= 50%.\n' +
          '• Intermediate / Functional Range: >= 70%.\n' +
          '• Advanced / Athletic Capacity: >= 88%.'
  },
  {
    key: 'RIGHT_WRIST_CHEST_CROSSING',
    name: 'Right Wrist Chest Crossing',
    category: 'Arms & Hands',
    min: 0,
    max: 100,
    step: 1,
    default_val: 70,
    dir: 'asc',
    desc: 'Right wrist adduction score relative to sternal chest midline (0-100%).\n\n' +
          '• Beginner / Risk Screening: >= 50%.\n' +
          '• Intermediate / Functional Range: >= 70%.\n' +
          '• Advanced / Athletic Capacity: >= 88%.'
  },
  {
    key: 'LEFT_PALM_ROTATION_ANGLE',
    name: 'Left Palm Rotation Angle',
    category: 'Arms & Hands',
    min: 0,
    max: 360,
    step: 1,
    default_val: 45,
    dir: 'asc',
    desc: '3D rotation angle of left hand relative to camera (0°-360°). 0°-45° = palm forward, 90° = knife hand, 135°-180° = palm backward.\n\n' +
          '• Beginner: 30° - 150°.\n' +
          '• Intermediate: 40° - 160°.\n' +
          '• Advanced: Continuous full spiral 0° to 180° in Shoulder CARs.'
  },
  {
    key: 'RIGHT_PALM_ROTATION_ANGLE',
    name: 'Right Palm Rotation Angle',
    category: 'Arms & Hands',
    min: 0,
    max: 360,
    step: 1,
    default_val: 45,
    dir: 'asc',
    desc: '3D rotation angle of right hand relative to camera (0°-360°). 0°-45° = palm forward, 90° = knife hand, 135°-180° = palm backward.\n\n' +
          '• Beginner: 30° - 150°.\n' +
          '• Intermediate: 40° - 160°.\n' +
          '• Advanced: Continuous full spiral 0° to 180° in Shoulder CARs.'
  },
  {
    key: 'LEFT_PALM_FACING_DIRECTION',
    name: 'Left Palm Facing Direction',
    category: 'Arms & Hands',
    min: -1,
    max: 1,
    step: 0.1,
    default_val: 0,
    dir: 'asc',
    desc: 'Normalized vector of left palm facing direction (-1.0 to +1.0). +1.0 = palm facing camera/forward, 0.0 = edge-on neutral, -1.0 = palm facing away/backward. Tracks pronation/supination in Shoulder CARs.\n\n' +
          '• Beginner: Supinated >= +0.5, Pronated <= -0.5.\n' +
          '• Intermediate: >= +0.8 / <= -0.8.\n' +
          '• Advanced: +1.0 / -1.0.'
  },
  {
    key: 'RIGHT_PALM_FACING_DIRECTION',
    name: 'Right Palm Facing Direction',
    category: 'Arms & Hands',
    min: -1,
    max: 1,
    step: 0.1,
    default_val: 0,
    dir: 'asc',
    desc: 'Normalized vector of right palm facing direction (-1.0 to +1.0). +1.0 = palm facing camera/forward, 0.0 = edge-on neutral, -1.0 = palm facing away/backward. Tracks pronation/supination in Shoulder CARs.\n\n' +
          '• Beginner: Supinated >= +0.5, Pronated <= -0.5.\n' +
          '• Intermediate: >= +0.8 / <= -0.8.\n' +
          '• Advanced: +1.0 / -1.0.'
  },

  // ==========================================
  // 7. WHOLE-BODY, BALANCE & TEMPORAL DYNAMICS
  // ==========================================
  {
    key: 'STANCE_WIDTH_RATIO',
    name: 'Stance Width Ratio',
    category: 'Balance & Velocity',
    min: 0.5,
    max: 2.5,
    step: 0.05,
    default_val: 1.15,
    dir: 'asc',
    desc: 'Ratio of heel-to-heel width divided by biacromial shoulder width (0.5-2.5). Standardizes squat and deadlift setup geometry across all body heights.\n\n' +
          '• Beginner / Risk Screening: 0.90 - 1.40 (Accommodating functional stance).\n' +
          '• Intermediate / Functional Range: 1.00 - 1.25 (Standard shoulder-width athletic power base).\n' +
          '• Advanced / Athletic Capacity: Narrow Squat: 0.70 - 0.95. Sumo / Wide Stance: 1.45 - 2.00.\n' +
          '• Form Check / Fault Alert: In standard squats, trigger "Widen your stance!" if < 0.80.'
  },
  {
    key: 'GRIP_WIDTH_RATIO',
    name: 'Grip Width Ratio',
    category: 'Balance & Velocity',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    default_val: 1.3,
    dir: 'asc',
    desc: 'Ratio of hand width divided by biacromial shoulder width (0.5-3.0). Governs bench press, overhead press, and pull-up biomechanics.\n\n' +
          '• Beginner / Risk Screening: 1.10 - 1.60 (Protects shoulder impingement under barbell).\n' +
          '• Intermediate / Functional Range: 1.20 - 1.50 (Optimal mechanical force angle).\n' +
          '• Advanced / Athletic Capacity: Close Grip: 0.80 - 1.00. Wide Grip: 1.60 - 2.20.\n' +
          '• Form Check / Fault Alert: On bench press, trigger "Bring hands closer to protect shoulders!" if > 2.20.'
  },
  {
    key: 'BILATERAL_SYMMETRY',
    name: 'Bilateral Symmetry Ratio',
    category: 'Balance & Velocity',
    min: 0.5,
    max: 2.0,
    step: 0.05,
    default_val: 1.0,
    dir: 'asc',
    desc: 'Joint angle ratio of Left side divided by Right side (0.5-2.0; 1.0 = perfect symmetry). Direct audit for muscular imbalances, favored limb dominance, and asymmetric load carriage.\n\n' +
          '• Beginner / Risk Screening: 0.85 - 1.15 (Up to 15% discrepancy acceptable in general population).\n' +
          '• Intermediate / Functional Range: 0.92 - 1.08 (High symmetry in bilateral squats and pulls).\n' +
          '• Advanced / Athletic Capacity: 0.96 - 1.04 (<4% discrepancy in elite athletes).\n' +
          '• Form Check / Fault Alert: Trigger "Distribute your weight evenly!" if < 0.80 or > 1.25.'
  },
  {
    key: 'BODY_ORIENTATION_ANGLE',
    name: 'Body Orientation Angle',
    category: 'Balance & Velocity',
    min: 0,
    max: 90,
    step: 1,
    default_val: 0,
    dir: 'asc',
    desc: 'Angle of full body line (heel to shoulder) relative to gravity vertical (0°-90°). Classifies exercise setup posture: 0° = standing, 90° = horizontal/prone/supine/pushup.\n\n' +
          '• Beginner / Risk Screening: Standing Exercises: <= 15°. Pushups/Planks: >= 75°.\n' +
          '• Intermediate / Functional Range: Standing: <= 8°. Pushups: >= 82°.\n' +
          '• Advanced / Athletic Capacity: Standing: <= 4°. Pushups: >= 88°.\n' +
          '• Form Check / Fault Alert: Flags incorrect exercise setup orientation before rep starts.'
  },
  {
    key: 'BODY_SWAY',
    name: 'Body Sway / Lateral Drift',
    category: 'Balance & Velocity',
    min: 0,
    max: 50,
    step: 1,
    default_val: 5,
    dir: 'desc',
    desc: 'Horizontal shift of center of mass (mid-hip) from initial calibrated setup coordinate (0-50 units). Measures vestibular balance and lateral hip control.\n\n' +
          '• Beginner / Risk Screening: <= 18 (Maintains balance on single leg or during lift).\n' +
          '• Intermediate / Functional Range: <= 8 (Solid anchored balance).\n' +
          '• Advanced / Athletic Capacity: <= 3 (Laser-still center of mass).\n' +
          '• Form Check / Fault Alert: Trigger "Stay centered, avoid shifting to one side!" if > 18.'
  },
  {
    key: 'HEAD_FORWARD_LEAN',
    name: 'Head Forward Lean (Cervical)',
    category: 'Balance & Velocity',
    min: 0,
    max: 60,
    step: 1,
    default_val: 5,
    dir: 'desc',
    desc: 'Horizontal offset distance of ear canal landmark forward of acromion shoulder landmark (0-60 units). Audits tech-neck, upper crossed syndrome, and cervical disc pressure.\n\n' +
          '• Beginner / Risk Screening: <= 25 (Mild forward head posture).\n' +
          '• Intermediate / Functional Range: <= 12 (Ears packed back over shoulders).\n' +
          '• Advanced / Athletic Capacity: <= 5 (Pristine cervical axial packing).\n' +
          '• Form Check / Fault Alert: Trigger "Pack your neck back, look straight ahead!" if > 25.'
  },
  {
    key: 'GAZE_ALIGNMENT',
    name: 'Gaze Alignment Pitch',
    category: 'Balance & Velocity',
    min: -90,
    max: 90,
    step: 1,
    default_val: 0,
    dir: 'asc',
    desc: 'Vertical pitch angle between eyes and ears relative to horizontal line (-90° to +90°). Audits cervical neutral packing vs excessive hyperextension/flexion (0° = level forward; -30° = floor; +30° = ceiling).\n\n' +
          '• Beginner / Risk Screening: -25° to +20° (Comfortable safe cervical zone).\n' +
          '• Intermediate / Functional Range: -15° to +10° (Neutral cervical spine following torso trajectory).\n' +
          '• Advanced / Athletic Capacity: -8° to +5° (Locked neutral gaze).\n' +
          '• Form Check / Fault Alert: Trigger "Keep neck neutral, don\'t look up at ceiling!" if > 35°.'
  },
  {
    key: 'VERTICAL_BAR_PATH',
    name: 'Vertical Bar Path Deviation',
    category: 'Balance & Velocity',
    min: 0,
    max: 50,
    step: 1,
    default_val: 6,
    dir: 'desc',
    desc: 'Horizontal distance deviation between hands/bar and mid-foot balance line throughout lift phases (0-50 units). Definitive bar path efficiency audit for barbell and dumbbell exercises.\n\n' +
          '• Beginner / Risk Screening: <= 18 (Bar stays within foot envelope).\n' +
          '• Intermediate / Functional Range: <= 8 (Linear vertical bar path with minimal moment arm).\n' +
          '• Advanced / Athletic Capacity: <= 3 (Perfect vertical line over center of mass).\n' +
          '• Form Check / Fault Alert: Trigger "Keep the weight close to your body!" if > 18.'
  },
  {
    key: 'STILLNESS_JITTER',
    name: 'Calibration Stillness Jitter',
    category: 'Balance & Velocity',
    min: 0,
    max: 100,
    step: 1,
    default_val: 15,
    dir: 'desc',
    desc: 'Inter-frame micro-displacement magnitude of landmarks during calibration/setup phases (0-100 units). Validates tracking stability and camera stillness before starting rep counter.\n\n' +
          '• Beginner / Risk Screening: <= 30 (Passes calibration).\n' +
          '• Intermediate / Functional Range: <= 15 (Stable locked athlete setup).\n' +
          '• Advanced / Athletic Capacity: <= 5 (Zero tremor / camera noise).\n' +
          '• Form Check / Fault Alert: If > 35: "Hold still for camera setup!".'
  },
  {
    key: 'CONCENTRIC_VELOCITY',
    name: 'Concentric Lifting Velocity',
    category: 'Balance & Velocity',
    min: 0,
    max: 100,
    step: 1,
    default_val: 25,
    dir: 'asc',
    desc: 'Upward speed of hips/center of mass during concentric lifting phase (0-100 units/s). Audits explosive power, speed-strength, and fatigue deceleration.\n\n' +
          '• Beginner / Risk Screening: >= 15 (Demonstrates baseline concentric drive).\n' +
          '• Intermediate / Functional Range: >= 30 (Solid athletic concentric power).\n' +
          '• Advanced / Athletic Capacity: >= 55 (Elite explosive bar speed / rate of force development).'
  },
  {
    key: 'ECCENTRIC_VELOCITY',
    name: 'Eccentric Lowering Velocity',
    category: 'Balance & Velocity',
    min: 0,
    max: 100,
    step: 1,
    default_val: 20,
    dir: 'desc',
    desc: 'Downward speed of hips/center of mass during eccentric lowering phase (0-100 units/s). Audits motor control, deceleration capacity, and prevents uncontrolled dive-bombing.\n\n' +
          '• Beginner / Risk Screening: <= 35 (Prevents uncontrolled dive-bomb descent).\n' +
          '• Intermediate / Functional Range: 12 - 25 (Standard 2-second controlled lowering tempo).\n' +
          '• Advanced / Athletic Capacity: 8 - 18 (Strict tempo deceleration under maximum loads).\n' +
          '• Form Check / Fault Alert: Trigger "Slow down your descent!" if > 45.'
  },
  {
    key: 'HIP_SAGITTAL_SHIFT',
    name: 'Hip Sagittal Shift',
    category: 'Spine & Trunk',
    min: 0,
    max: 50,
    step: 1,
    default_val: 0,
    dir: 'asc',
    desc: 'Forward horizontal displacement of the hip from its initial calibrated setup position (0-50 units). Used specifically in side-profile views to detect when a user leans forward or detaches their hips from a wall.\n\n' +
          '• Beginner / Risk Screening: <= 10 (Allowable slight forward shift during initial learning).\n' +
          '• Intermediate / Functional Range: <= 5 (Minimal hip detachment, maintaining core stability).\n' +
          '• Advanced / Athletic Capacity: <= 2 (Perfectly anchored pelvis without any forward glide).\n' +
          '• Form Check / Fault Alert: Trigger "Hips detached from the wall! Stop there." if > 5.'
  },
  {
    key: 'SPINE_CURVATURE_INDEX',
    name: 'Spine Curvature Index',
    category: 'Spine & Trunk',
    min: 0,
    max: 75,
    step: 1,
    default_val: 35,
    dir: 'asc',
    desc: 'Mathematical parabolic curvature (a * 10,000) of the posterior silhouette contour along the sagittal back profile (0-75 units). Detects real-time segmental articulation across thoracic and lumbar spine.\n\n' +
          '• Standing Neutral / Flat Back: <= 12 (Natural spinal curves, minimal rounding).\n' +
          '• Segmental Articulation / Wave Initiation: 15 - 28 (Smooth flexion curling starting from cervical/thoracic).\n' +
          '• Deep Curvature / Maximal Spinal Flexion: 30 - 55+ (Full segmental thoracic and lumbar flexion in Jefferson curl or Cat pose).\n' +
          '• Kinematic Fallback Mode: Seamlessly computes via torso compression ratio if silhouette mask is obstructed.'
  },
  {
    key: 'CERVICAL_UPPER_ANGLE',
    name: 'Upper Cervical (C1–C3) Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 45,
    step: 1,
    default_val: 15,
    dir: 'asc',
    desc: 'Localized sagittal deflection angle of the upper cervical spine / suboccipital complex (C1–C3) relative to vertical (0°-45°).\n\n' +
          '• Neutral Head Posture: <= 12° (Balanced cranial alignment over cervical spine).\n' +
          '• Forward Cranial Wave: 15° - 25° (Controlled chin tuck and suboccipital flexion initiation).\n' +
          '• Fault / Compensation: > 28° (Excessive chin poking / forward head tilt overcompensation).'
  },
  {
    key: 'CERVICOTHORACIC_ANGLE',
    name: 'Cervicothoracic (C4–C7) Hinge Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 50,
    step: 1,
    default_val: 18,
    dir: 'asc',
    desc: 'Sagittal flexion hinge angle at the base of the neck / cervicothoracic junction (C4–C7 / T1) (0°-50°).\n\n' +
          '• Neutral Standing: <= 10°.\n' +
          '• Controlled Neck Flexion: 15° - 25°.\n' +
          '• Fault / Shear Alert: > 30° (Excessive localized neck craning without thoracic articulation).'
  },
  {
    key: 'THORACIC_UPPER_ANGLE',
    name: 'Upper Thoracic (T1–T4) Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 45,
    step: 1,
    default_val: 20,
    dir: 'asc',
    desc: 'Localized sagittal deflection and kyphosis initiation across upper thoracic vertebrae (T1–T4) (0°-45°).\n\n' +
          '• Neutral Upright: <= 8°.\n' +
          '• Healthy Articulation: 15° - 25°.\n' +
          '• Hypomobility / Stiffness Fault: < 5° when rounding is requested.'
  },
  {
    key: 'THORACIC_MID_ANGLE',
    name: 'Mid-Thoracic (T5–T8) Curvature Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 55,
    step: 1,
    default_val: 28,
    dir: 'asc',
    desc: 'Peak curvature angle across the mid-thoracic spine (T5–T8 apex) (0°-55°). The core diagnostic metric for thoracic mobility assessments (Jefferson curls, Cat-Cow, Wall Peel).\n\n' +
          '• Standing Flat: <= 10°.\n' +
          '• Moderate Flexion: 18° - 32°.\n' +
          '• Deep Thoracic Mobility: >= 35°.'
  },
  {
    key: 'THORACOLUMBAR_ANGLE',
    name: 'Thoracolumbar (T9–T12) Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 40,
    step: 1,
    default_val: 18,
    dir: 'asc',
    desc: 'Deflection angle at the lower ribcage / thoracolumbar junction (T9–T12) (0°-40°). Monitors mid-spine rotational pivot and prevents rib flaring / hinge shear.\n\n' +
          '• Normal Range: 10° - 25°.\n' +
          '• Over-Hinge Alert: > 30°.'
  },
  {
    key: 'LUMBAR_UPPER_ANGLE',
    name: 'Upper Lumbar (L1–L3) Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 35,
    step: 1,
    default_val: 12,
    dir: 'asc',
    desc: 'Sagittal curvature angle across upper lumbar vertebrae (L1–L3) (0°-35°). Audits core bracing integrity and lumbar lordosis flattening under flexion.\n\n' +
          '• Neutral Lordosis: <= 8°.\n' +
          '• Controlled Flexion: 10° - 20°.'
  },
  {
    key: 'LUMBOSACRAL_ANGLE',
    name: 'Lumbosacral (L4–S1) Base Angle',
    category: 'Spine & Trunk',
    min: 0,
    max: 35,
    step: 1,
    default_val: 10,
    dir: 'asc',
    desc: 'Localized shear / hinge angle at the lumbosacral junction (L4–L5–S1) relative to pelvis (0°-35°).\n\n' +
          '• Neutral Spine: <= 8°.\n' +
          '• Controlled Wave: 10° - 18°.\n' +
          '• Form Fault (Pelvic Hinge Cheating): > 22° (Flags bending from lower back instead of upper thoracic).'
  },
  {
    key: 'FOREARM_SAGITTAL_ROTATION',
    name: 'Forearm Sagittal Rotation Arc',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 0,
    dir: 'asc',
    desc: 'Continuous sagittal sweep angle of active forearm relative to vertical (0°-180°). 0° = pointing straight up near ear, 90° = horizontal, 180° = pointing straight down toward floor. Used in side-view shoulder rotation assessments.\n\n' +
          '• Beginner / Risk Screening: Setup: <= 20°, Internal Sweep: >= 140°.\n' +
          '• Intermediate / Functional Range: Setup: <= 15°, Internal Sweep: >= 165°.\n' +
          '• Advanced / Athletic Capacity: Setup: <= 5°, Internal Sweep: >= 175° (Full unrestricted glenohumeral rotation).\n' +
          '• Form Check / Fault Alert: Combine with ELBOW_ANGLE (80°-100°) to ensure 90° elbow lock throughout.'
  },
  {
    key: 'LEFT_FOREARM_SAGITTAL_ROTATION',
    name: 'Left Forearm Sagittal Rotation',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 0,
    dir: 'asc',
    desc: 'Continuous sagittal sweep angle of left forearm relative to vertical (0°-180°). 0° = straight up near ear, 90° = horizontal, 180° = straight down toward floor.\n\n' +
          '• Beginner: Sweep >= 140°.\n' +
          '• Intermediate: Sweep >= 165°.\n' +
          '• Advanced: Sweep >= 175°.'
  },
  {
    key: 'RIGHT_FOREARM_SAGITTAL_ROTATION',
    name: 'Right Forearm Sagittal Rotation',
    category: 'Arms & Hands',
    min: 0,
    max: 180,
    step: 1,
    default_val: 0,
    dir: 'asc',
    desc: 'Continuous sagittal sweep angle of right forearm relative to vertical (0°-180°). 0° = straight up near ear, 90° = horizontal, 180° = straight down toward floor.\n\n' +
          '• Beginner: Sweep >= 140°.\n' +
          '• Intermediate: Sweep >= 165°.\n' +
          '• Advanced: Sweep >= 175°.'
  }
];

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB');

    // Ensure columns exist
    await client.query(`
      ALTER TABLE master_metrics ADD COLUMN IF NOT EXISTS default_val NUMERIC;
      ALTER TABLE master_metrics ADD COLUMN IF NOT EXISTS category VARCHAR(100);
    `);
    console.log('Schema updated with default_val and category');

    let upsertCount = 0;
    for (const m of ALL_MASTER_METRICS) {
      await client.query(`
        INSERT INTO master_metrics (metric_key, metric_name, description, min_val, max_val, step_val, direction, default_val, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (metric_key) DO UPDATE SET
          metric_name = EXCLUDED.metric_name,
          description = EXCLUDED.description,
          min_val = EXCLUDED.min_val,
          max_val = EXCLUDED.max_val,
          step_val = EXCLUDED.step_val,
          direction = EXCLUDED.direction,
          default_val = EXCLUDED.default_val,
          category = EXCLUDED.category;
      `, [m.key, m.name, m.desc, m.min, m.max, m.step, m.dir, m.default_val, m.category]);
      upsertCount++;
    }

    console.log(`Successfully upserted ${upsertCount} Master Metrics!`);
    const countRes = await client.query('SELECT count(*) FROM master_metrics');
    console.log(`Total metrics now in DB: ${countRes.rows[0].count}`);
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { ALL_MASTER_METRICS, seed };
