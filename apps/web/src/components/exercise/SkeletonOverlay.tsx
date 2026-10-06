'use client';

import React, { useEffect, useRef } from 'react';
import { PoseData, DynamicRule, SpineCurvatureResult } from '@workout/shared';

interface SkeletonOverlayProps {
  pose: PoseData | null;
  spineData?: SpineCurvatureResult | null;
  width: number;
  height: number;
  videoSize: {
    width: number;
    height: number;
  } | null;
  smoothing?: number;
  showAngles?: boolean;
  showSilhouette?: boolean;
}

const POSE_CONNECTIONS = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
  ['LEFT_ANKLE', 'LEFT_HEEL'],
  ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'],
  ['LEFT_HEEL', 'LEFT_FOOT_INDEX'],
  ['RIGHT_ANKLE', 'RIGHT_HEEL'],
  ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],
  ['RIGHT_HEEL', 'RIGHT_FOOT_INDEX'],

  // Hand / Palm Connections
  ['LEFT_WRIST', 'LEFT_INDEX'],
  ['LEFT_WRIST', 'LEFT_PINKY'],
  ['LEFT_WRIST', 'LEFT_THUMB'],
  ['LEFT_PINKY', 'LEFT_INDEX'],
  ['RIGHT_WRIST', 'RIGHT_INDEX'],
  ['RIGHT_WRIST', 'RIGHT_PINKY'],
  ['RIGHT_WRIST', 'RIGHT_THUMB'],
  ['RIGHT_PINKY', 'RIGHT_INDEX'],
];

const LEFT_SIDE_COLOR = '#39FF14'; // Neon Green
const RIGHT_SIDE_COLOR = '#39FF14'; // Neon Green
const CENTER_COLOR = '#ffffff';

function getLandmarkColor(name: string) {
  if (name.startsWith('LEFT_')) {
    return LEFT_SIDE_COLOR;
  }

  if (name.startsWith('RIGHT_')) {
    return RIGHT_SIDE_COLOR;
  }

  return CENTER_COLOR;
}

function getConnectionColor(startName: string, endName: string) {
  const startColor = getLandmarkColor(startName);
  const endColor = getLandmarkColor(endName);

  return startColor === endColor ? startColor : CENTER_COLOR;
}

function calculateAngle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}


export const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  pose,
  spineData,
  width,
  height,
  videoSize,
  smoothing = 0.3,
  showAngles = true,
  showSilhouette = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedPoseRef = useRef<PoseData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!pose) {
      smoothedPoseRef.current = null;
      return;
    }

    const videoWidth = videoSize?.width || width;
    const videoHeight = videoSize?.height || height;
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = width / height;
    const renderedWidth = videoAspect > canvasAspect ? width : height * videoAspect;
    const renderedHeight = videoAspect > canvasAspect ? width / videoAspect : height;
    const offsetX = (width - renderedWidth) / 2;
    const offsetY = (height - renderedHeight) / 2;

    const getCanvasPoint = (landmark: PoseData[string]) => {
      const sourceX = offsetX + landmark.x * renderedWidth;
      const sourceY = offsetY + landmark.y * renderedHeight;

      return {
        x: width - sourceX,
        y: sourceY,
      };
    };

    const previousPose = smoothedPoseRef.current;
    const smoothedPose: PoseData = {};

    Object.entries(pose).forEach(([name, landmark]) => {
      const previousLandmark = previousPose?.[name];
      const factor = previousLandmark ? smoothing : 0;

      smoothedPose[name] = {
        x: previousLandmark
          ? previousLandmark.x * factor + landmark.x * (1 - factor)
          : landmark.x,
        y: previousLandmark
          ? previousLandmark.y * factor + landmark.y * (1 - factor)
          : landmark.y,
        z: landmark.z,
        visibility: landmark.visibility,
      };
    });

    smoothedPoseRef.current = smoothedPose;

    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;

    POSE_CONNECTIONS.forEach(([p1, p2]) => {
      const start = smoothedPose[p1];
      const end = smoothedPose[p2];

      if (start && end && (start.visibility || 0) > 0.5 && (end.visibility || 0) > 0.5) {
        const startPoint = getCanvasPoint(start);
        const endPoint = getCanvasPoint(end);
        const color = getConnectionColor(p1, p2);

        ctx.strokeStyle = color;
        ctx.shadowColor = color;

        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();
      }
    });

    ctx.shadowBlur = 5;

    Object.entries(smoothedPose).forEach(([name, landmark]) => {
      if ((landmark.visibility || 0) > 0.5) {
        const point = getCanvasPoint(landmark);
        const color = getLandmarkColor(name);
        ctx.fillStyle = color;
        ctx.shadowColor = color;

        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Draw angles for key joints
    if (showAngles) {
      // Create virtual points for Torso Angle
      const leftHip = smoothedPose['LEFT_HIP'];
      const rightHip = smoothedPose['RIGHT_HIP'];
      const leftShoulder = smoothedPose['LEFT_SHOULDER'];
      const rightShoulder = smoothedPose['RIGHT_SHOULDER'];

      if (leftHip && rightHip && leftShoulder && rightShoulder) {
        smoothedPose['MID_HIP'] = {
          x: (leftHip.x + rightHip.x) / 2,
          y: (leftHip.y + rightHip.y) / 2,
          z: (leftHip.z! + rightHip.z!) / 2,
          visibility: Math.min(leftHip.visibility || 0, rightHip.visibility || 0)
        };
        smoothedPose['MID_SHOULDER'] = {
          x: (leftShoulder.x + rightShoulder.x) / 2,
          y: (leftShoulder.y + rightShoulder.y) / 2,
          z: (leftShoulder.z! + rightShoulder.z!) / 2,
          visibility: Math.min(leftShoulder.visibility || 0, rightShoulder.visibility || 0)
        };
        smoothedPose['VERTICAL_REF'] = {
          x: smoothedPose['MID_HIP'].x,
          y: smoothedPose['MID_HIP'].y - 0.5, // Point vertically above the hip
          z: smoothedPose['MID_HIP'].z,
          visibility: smoothedPose['MID_HIP'].visibility
        };
      }

      const anglesToDraw = [
        { a: 'LEFT_SHOULDER', b: 'LEFT_ELBOW', c: 'LEFT_WRIST' },
        { a: 'RIGHT_SHOULDER', b: 'RIGHT_ELBOW', c: 'RIGHT_WRIST' },
        { a: 'LEFT_SHOULDER', b: 'LEFT_HIP', c: 'LEFT_KNEE' },
        { a: 'RIGHT_SHOULDER', b: 'RIGHT_HIP', c: 'RIGHT_KNEE' },
        { a: 'LEFT_HIP', b: 'LEFT_KNEE', c: 'LEFT_ANKLE' },
        { a: 'RIGHT_HIP', b: 'RIGHT_KNEE', c: 'RIGHT_ANKLE' },
        // Foot angles
        { a: 'LEFT_KNEE', b: 'LEFT_ANKLE', c: 'LEFT_FOOT_INDEX' },
        { a: 'RIGHT_KNEE', b: 'RIGHT_ANKLE', c: 'RIGHT_FOOT_INDEX' },
        // Torso angle
        { a: 'VERTICAL_REF', b: 'MID_HIP', c: 'MID_SHOULDER' }
      ];

      ctx.font = 'bold 21px Inter, sans-serif'; // Increased by ~30% from 16px
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0; // Disable shadow for the pill

      anglesToDraw.forEach(({ a, b, c }) => {
        const pA = smoothedPose[a];
        const pB = smoothedPose[b];
        const pC = smoothedPose[c];

        if (
          pA && pB && pC &&
          (pA.visibility || 0) > 0.5 &&
          (pB.visibility || 0) > 0.5 &&
          (pC.visibility || 0) > 0.5
        ) {
          const ptA = getCanvasPoint(pA);
          const ptB = getCanvasPoint(pB);
          const ptC = getCanvasPoint(pC);

          const angle = calculateAngle(ptA, ptB, ptC);
          
          // Offset the text so it doesn't overlap exactly with the joint point
          // Since LEFT_ joints are on the left side of the mirrored canvas, we subtract to push them further left (outside).
          // RIGHT_ joints are on the right side of the canvas, so we add to push them further right (outside).
          let offsetX = b.startsWith('LEFT_') ? -75 : 75;
          
          let x = ptB.x + offsetX;
          let y = ptB.y;
          
          // Move torso angle exactly to the pit of the throat (between shoulders)
          if (b === 'MID_HIP' && c === 'MID_SHOULDER') {
            x = ptC.x; // MID_SHOULDER X (centered)
            y = ptC.y; // MID_SHOULDER Y (at throat)
          }
          
          const text = `${Math.round(angle)}°`;
          const textWidth = ctx.measureText(text).width;
          const rectWidth = textWidth + 12;
          const rectHeight = 26;

          // Draw background pill
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x - rectWidth / 2, y - rectHeight / 2, rectWidth, rectHeight, 8);
          } else {
            ctx.rect(x - rectWidth / 2, y - rectHeight / 2, rectWidth, rectHeight);
          }
          ctx.fill();

          // Draw Text
          ctx.fillStyle = '#39FF14'; // Neon Green
          ctx.fillText(text, x, y + 2); // +2 for visual baseline alignment
        }
      });

      // Left Hip Abduction Angle Display
      const leftHipLm = smoothedPose['LEFT_HIP'];
      const leftKneeLm = smoothedPose['LEFT_KNEE'];
      if (
        leftHipLm && leftKneeLm &&
        (leftHipLm.visibility || 0) > 0.4 &&
        (leftKneeLm.visibility || 0) > 0.4
      ) {
        const leftHipAbd = DynamicRule.calculateMetric('LEFT_HIP_ABDUCTION', smoothedPose);
        const ptHip = getCanvasPoint(leftHipLm);
        const ptKnee = getCanvasPoint(leftKneeLm);

        // Position on the lateral (outer) side of the left thigh
        const midThighX = (ptHip.x + ptKnee.x) / 2;
        const midThighY = (ptHip.y + ptKnee.y) / 2;
        const x = midThighX - 85;
        const y = midThighY;

        const text = `ABD ${Math.round(leftHipAbd)}°`;
        ctx.font = 'bold 20px Inter, sans-serif';
        const textWidth = ctx.measureText(text).width;
        const rectWidth = textWidth + 14;
        const rectHeight = 28;

        // Draw background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x - rectWidth / 2, y - rectHeight / 2, rectWidth, rectHeight, 8);
        } else {
          ctx.rect(x - rectWidth / 2, y - rectHeight / 2, rectWidth, rectHeight);
        }
        ctx.fill();

        // Subtle glowing neon border
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Draw Text
        ctx.fillStyle = '#39FF14'; // Neon Green
        ctx.fillText(text, x, y + 2);
      }

      // Right Hip Abduction Angle Display (when active)
      const rightHipLm = smoothedPose['RIGHT_HIP'];
      const rightKneeLm = smoothedPose['RIGHT_KNEE'];
      if (
        rightHipLm && rightKneeLm &&
        (rightHipLm.visibility || 0) > 0.4 &&
        (rightKneeLm.visibility || 0) > 0.4
      ) {
        const rightHipAbd = DynamicRule.calculateMetric('RIGHT_HIP_ABDUCTION', smoothedPose);
        if (rightHipAbd > 5) {
          const ptRHip = getCanvasPoint(rightHipLm);
          const ptRKnee = getCanvasPoint(rightKneeLm);

          const midRThighX = (ptRHip.x + ptRKnee.x) / 2;
          const midRThighY = (ptRHip.y + ptRKnee.y) / 2;
          const xR = midRThighX + 85;
          const yR = midRThighY;

          const textR = `ABD ${Math.round(rightHipAbd)}°`;
          ctx.font = 'bold 20px Inter, sans-serif';
          const textWidthR = ctx.measureText(textR).width;
          const rectWidthR = textWidthR + 14;
          const rectHeightR = 28;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(xR - rectWidthR / 2, yR - rectHeightR / 2, rectWidthR, rectHeightR, 8);
          } else {
            ctx.rect(xR - rectWidthR / 2, yR - rectHeightR / 2, rectWidthR, rectHeightR);
          }
          ctx.fill();

          ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = '#39FF14';
          ctx.fillText(textR, xR, yR + 2);
        }
      }

      // Knee Outside Hand (Fire Hydrant Clearance) Display
      const leftWristLm = smoothedPose['LEFT_WRIST'];
      if (
        leftWristLm && leftKneeLm && leftHipLm &&
        (leftWristLm.visibility || 0) > 0.3 &&
        (leftKneeLm.visibility || 0) > 0.3
      ) {
        const kneeOutsideRatio = DynamicRule.calculateMetric('LEFT_KNEE_OUTSIDE_HAND_RATIO', smoothedPose);
        const ptWrist = getCanvasPoint(leftWristLm);
        const ptKnee = getCanvasPoint(leftKneeLm);
        const ptHip = getCanvasPoint(leftHipLm);

        // Check if user is in quadruped / all-fours (wrist and knee on or near floor plane)
        const isQuadruped = Math.abs(ptWrist.y - ptKnee.y) < height * 0.45;

        if (isQuadruped) {
          ctx.save();
          const isCleared = kneeOutsideRatio >= 0.10;
          const isPositive = kneeOutsideRatio > 0;

          // Color based on clearance: Neon Green if cleared, Amber if slight, Muted White if in-line
          const guideColor = isCleared
            ? '#39FF14'
            : isPositive
              ? '#FFB800'
              : 'rgba(255, 255, 255, 0.45)';

          // 1. Draw Hand Line Guide extending from planted Left Wrist straight back
          ctx.strokeStyle = guideColor;
          ctx.lineWidth = isCleared ? 2.5 : 1.5;
          ctx.setLineDash(isCleared ? [] : [6, 4]);

          ctx.beginPath();
          ctx.moveTo(ptWrist.x, ptWrist.y);
          // Hand line passes straight back along the torso axis
          const dirX = ptHip.x - ptWrist.x;
          const dirY = ptHip.y - ptWrist.y;
          const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
          const extX = ptWrist.x + (dirX / len) * (len * 1.3);
          const extY = ptWrist.y + (dirY / len) * (len * 1.3);
          ctx.lineTo(extX, extY);
          ctx.stroke();

          // 2. Lateral offset connector line between knee and hand line
          if (isPositive) {
            ctx.strokeStyle = isCleared ? 'rgba(57, 255, 20, 0.7)' : 'rgba(255, 184, 0, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(ptKnee.x, ptKnee.y);
            // Nearest point along the hand line projection
            const uX = dirX / len;
            const uY = dirY / len;
            const wToKneeX = ptKnee.x - ptWrist.x;
            const wToKneeY = ptKnee.y - ptWrist.y;
            const projLen = wToKneeX * uX + wToKneeY * uY;
            const projX = ptWrist.x + uX * projLen;
            const projY = ptWrist.y + uY * projLen;
            ctx.lineTo(projX, projY);
            ctx.stroke();
          }

          // 3. Floating Clearance Badge near the knee
          const pct = Math.round(kneeOutsideRatio * 100);
          const badgeText = isCleared
            ? `OUTSIDE HAND +${pct}%`
            : isPositive
              ? `CLEARING +${pct}%`
              : `IN-LINE WITH HAND`;

          const badgeX = ptKnee.x - 80;
          const badgeY = ptKnee.y + 26;

          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const badgeWidth = ctx.measureText(badgeText).width + 16;
          const badgeHeight = 22;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(badgeX - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 6);
          } else {
            ctx.rect(badgeX - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight);
          }
          ctx.fill();

          ctx.strokeStyle = guideColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = guideColor;
          ctx.fillText(badgeText, badgeX, badgeY + 1);

          ctx.restore();
        }
      }
    }

    // 1. Draw Cervical / Head-to-Shoulder AI Silhouette Boundary (Neon Violet / Magenta)
    if (showSilhouette && spineData && spineData.cervicalContourPoints && spineData.cervicalContourPoints.length > 1) {
      ctx.save();
      const neckPts = spineData.cervicalContourPoints.map(p => getCanvasPoint({ x: p.x, y: p.y, z: 0 }));

      // Draw glowing curved boundary silhouette line for Neck & Head
      ctx.beginPath();
      ctx.moveTo(neckPts[0].x, neckPts[0].y);
      if (neckPts.length === 2) {
        ctx.lineTo(neckPts[1].x, neckPts[1].y);
      } else {
        for (let i = 0; i < neckPts.length - 1; i++) {
          const xc = (neckPts[i].x + neckPts[i + 1].x) / 2;
          const yc = (neckPts[i].y + neckPts[i + 1].y) / 2;
          ctx.quadraticCurveTo(neckPts[i].x, neckPts[i].y, xc, yc);
        }
        ctx.lineTo(neckPts[neckPts.length - 1].x, neckPts[neckPts.length - 1].y);
      }
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.85)'; // Neon Magenta / Rose Halo
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 9;
      ctx.stroke();

      // Draw boundary sensor dots along the neck/head edge
      ctx.setLineDash([]);
      neckPts.forEach((pt) => {
        ctx.fillStyle = '#ec4899';
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.8, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Cervical Spine / Neck Badge
      if (neckPts.length > 0) {
        const topPt = neckPts[0];
        const badgeX = topPt.x - 55;
        const badgeY = topPt.y - 12;
        const text = 'CERVICAL';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textW = ctx.measureText(text).width;
        const bW = textW + 10;
        const bH = 16;

        ctx.fillStyle = 'rgba(20, 0, 30, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(badgeX - bW / 2, badgeY - bH / 2, bW, bH, 4);
        else ctx.rect(badgeX - bW / 2, badgeY - bH / 2, bW, bH);
        ctx.fill();

        ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ec4899';
        ctx.fillText(text, badgeX, badgeY + 0.5);
      }

      ctx.restore();
    }

    // 2. Draw Thoracic & Lumbar AI Silhouette Mask Boundary (Neon Cyan)
    if (showSilhouette && spineData && spineData.contourPoints && spineData.contourPoints.length > 2) {
      ctx.save();
      const cPts = spineData.contourPoints.map(p => getCanvasPoint({ x: p.x, y: p.y, z: 0 }));

      // Draw glowing smooth curved boundary silhouette line
      ctx.beginPath();
      ctx.moveTo(cPts[0].x, cPts[0].y);
      for (let i = 0; i < cPts.length - 1; i++) {
        const xc = (cPts[i].x + cPts[i + 1].x) / 2;
        const yc = (cPts[i].y + cPts[i + 1].y) / 2;
        ctx.quadraticCurveTo(cPts[i].x, cPts[i].y, xc, yc);
      }
      ctx.lineTo(cPts[cPts.length - 1].x, cPts[cPts.length - 1].y);
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.75)'; // Cyan halo
      ctx.lineWidth = 2.4;
      ctx.setLineDash([4, 3]);
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Draw boundary sensor dots along the silhouette edge
      ctx.setLineDash([]);
      cPts.forEach((pt) => {
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.8, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Silhouette Mask Badge near top boundary point
      if (cPts.length > 0) {
        const topPt = cPts[0];
        const badgeX = topPt.x - 65;
        const badgeY = topPt.y - 14;
        const text = 'THORACIC / LUMBAR';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textW = ctx.measureText(text).width;
        const bW = textW + 10;
        const bH = 16;

        ctx.fillStyle = 'rgba(0, 20, 43, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(badgeX - bW / 2, badgeY - bH / 2, bW, bH, 4);
        else ctx.rect(badgeX - bW / 2, badgeY - bH / 2, bW, bH);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#00f2fe';
        ctx.fillText(text, badgeX, badgeY + 0.5);
      }

      ctx.restore();
    }

  }, [pose, spineData, width, height, videoSize, smoothing, showAngles, showSilhouette]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
};
