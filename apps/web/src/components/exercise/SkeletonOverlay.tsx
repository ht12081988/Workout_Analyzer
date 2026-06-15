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

export const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  pose,
  width,
  height,
  videoSize,
  smoothing = 0.3,
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
  }, [pose, width, height, videoSize, smoothing]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
};
