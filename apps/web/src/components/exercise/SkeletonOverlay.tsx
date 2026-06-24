'use client';

import React, { useEffect, useRef } from 'react';
import { PoseData } from '@workout/shared';

interface SkeletonOverlayProps {
  pose: PoseData | null;
  width: number;
  height: number;
  videoSize: {
    width: number;
    height: number;
  } | null;
  smoothing?: number;
  showAngles?: boolean;
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
  width,
  height,
  videoSize,
  smoothing = 0.3,
  showAngles = true,
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
    }

  }, [pose, width, height, videoSize, smoothing, showAngles]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
};
