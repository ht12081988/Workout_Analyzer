select * from customers
select * From exercises
select * from tracking_configs
select * from workout_sessions where exercise_id = 'e01dde30-2d18-4d02-b152-6046f203f30b'
select * from workout_attempts where exercise_id = 'e01dde30-2d18-4d02-b152-6046f203f30b'
select * from workout_rep_logs where session_id = '68a95190-2396-4cd8-8720-e6525aff4bbc'
select * from workout_landmark_frames where session_id = '68a95190-2396-4cd8-8720-e6525aff4bbc'
select * from workout_joint_angles where session_id = '68a95190-2396-4cd8-8720-e6525aff4bbc'
select * from workout_deviation_logs
SELECT * FROM exercise_pose_rules ORDER BY exercise_name DESC
SELECT * FROM voice_configs
SELECT * FROM voice_cues
SELECT * FROM voice_failure_guidance

DELETE FROM workout_sessions WHERE start_time < '2026-05-13'
DELETE FROM workout_attempts WHERE created_at < '2026-05-13'
DELETE FROM workout_rep_logs WHERE start_frame_time < '2026-05-13'
DELETE FROM workout_landmark_frames WHERE timestamp < '2026-05-13'
DELETE FROM workout_joint_angles WHERE created_at < '2026-05-13'
DELETE FROM workout_deviation_logs WHERE created_at < '2026-05-20'


