import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface IconProps {
  color?: string;
  size?: number;
}

// ─── Tab Bar Icons ────────────────────────────────────────────────────────────

export function DreamsIcon({ color = '#E7E9EE', size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 4L19.8 6.2L22 7L19.8 7.8L19 10L18.2 7.8L16 7L18.2 6.2L19 4Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrackerIcon({ color = '#E7E9EE', size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="3"
        stroke={color}
        strokeWidth="1.8"
      />
      <Path
        d="M2 10H22"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Circle cx="6" cy="14.5" r="1.2" fill={color} />
      <Path
        d="M14 14.5H18"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function VaultIcon({ color = '#E7E9EE', size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        stroke={color}
        strokeWidth="1.8"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <Path d="M12 9V7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 17V15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M9 12H7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M17 12H15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="5" cy="6.5" r="0.8" fill={color} />
      <Circle cx="5" cy="17.5" r="0.8" fill={color} />
    </Svg>
  );
}

export function SettingsIcon({ color = '#E7E9EE', size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <Path
        d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88C20.18 17.27 20.18 17.9 19.79 18.29L18.29 19.79C17.9 20.18 17.27 20.18 16.88 19.79L16.82 19.73A1.65 1.65 0 0 0 15 19.4A1.65 1.65 0 0 0 13.8 20.95V21C13.8 21.55 13.35 22 12.8 22H11.2C10.65 22 10.2 21.55 10.2 21V20.95A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.18 19.73L7.12 19.79C6.73 20.18 6.1 20.18 5.71 19.79L4.21 18.29C3.82 17.9 3.82 17.27 4.21 16.88L4.27 16.82A1.65 1.65 0 0 0 4.6 15A1.65 1.65 0 0 0 3.05 13.8H3C2.45 13.8 2 13.35 2 12.8V11.2C2 10.65 2.45 10.2 3 10.2H3.05A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.27 7.18L4.21 7.12C3.82 6.73 3.82 6.1 4.21 5.71L5.71 4.21C6.1 3.82 6.73 3.82 7.12 4.21L7.18 4.27A1.65 1.65 0 0 0 9 4.6A1.65 1.65 0 0 0 10.2 3.05V3C10.2 2.45 10.65 2 11.2 2H12.8C13.35 2 13.8 2.45 13.8 3V3.05A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21C17.27 3.82 17.9 3.82 18.29 4.21L19.79 5.71C20.18 6.1 20.18 6.73 19.79 7.12L19.73 7.18A1.65 1.65 0 0 0 19.4 9A1.65 1.65 0 0 0 20.95 10.2H21C21.55 10.2 22 10.65 22 11.2V12.8C22 13.35 21.55 13.8 21 13.8H20.95A1.65 1.65 0 0 0 19.4 15Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Action & Status Icons ───────────────────────────────────────────────────

export function PlusIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function TrashIcon({ color = '#EF4444', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6H21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M19 6V20C19 21.1 18.1 22 17 22H7C5.9 22 5 21.1 5 20V6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M8 6V4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 11V17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M14 11V17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function CopyIcon({ color = '#06B6D4', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="9" width="13" height="13" rx="2" stroke={color} strokeWidth="1.8" />
      <Path d="M5 15H4C2.9 15 2 14.1 2 13V4C2 2.9 2.9 2 4 2H13C14.1 2 15 2.9 15 4V5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldLockIcon({ color = '#10B981', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="11.5" r="2" stroke={color} strokeWidth="1.5" />
      <Path d="M12 13.5V16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ color = '#FFFFFF', size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LayersIcon({ color = '#E7E9EE', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L2 7L12 12L22 7L12 2Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 17L12 22L22 17"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 12L12 17L22 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8" />
      <Path d="M16 2V6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M8 2V6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M3 10H21" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

export function ArrowDownIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4V20" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 14L12 20L6 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowUpRightIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 17L17 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 7H17V17" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HomeIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.2L12 3L21 10.2V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V10.2Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ContactlessIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 16C9.8 15.2 10.2 14 10.2 12.8C10.2 11.6 9.8 10.4 9 9.6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M12.5 18.5C14 17 14.8 15 14.8 12.8C14.8 10.6 14 8.6 12.5 7.1"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M16 21C18.2 18.8 19.5 16 19.5 12.8C19.5 9.6 18.2 6.8 16 4.6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function AnalyticsIcon({ color = '#2563EB', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 20V10" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 20V4" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 20V14" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TargetIcon({ color = '#2563EB', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}

