import { useRef, useState } from 'react';
import type { VirtualHeldAction, VirtualPulseAction } from '../core/input';
import type { UiLocaleBundle } from '../data/i18n';
import { TOOL_ORDER, TOOL_SPECS, type ToolId } from '../data/tools';
import { ToolSvgIcon } from './ToolSvgIcon';

interface TouchControlsProps {
  locale: UiLocaleBundle;
  crouching: boolean;
  purring: boolean;
  compact?: boolean;
  landscape?: boolean;
  activeTool: ToolId;
  toolCooldowns: Record<ToolId, number>;
  dashCooldownPct?: number;
  dashActive?: boolean;
  senseCooldownPct?: number;
  senseActive?: boolean;
  gliding?: boolean;
  targetLedgeReady?: boolean;
  hasNearbyPrompt?: boolean;
  onAxisChange: (forward: number, right: number) => void;
  onHeldChange: (action: VirtualHeldAction, active: boolean) => void;
  onPulseAction: (action: VirtualPulseAction) => void;
  onCycleTool: () => void;
  onSelectTool: (toolId: ToolId) => void;
}

export function TouchControls({
  locale,
  crouching,
  purring,
  compact = false,
  landscape = false,
  activeTool,
  toolCooldowns,
  dashCooldownPct = 0,
  dashActive = false,
  senseCooldownPct = 0,
  senseActive = false,
  gliding = false,
  targetLedgeReady = false,
  hasNearbyPrompt = false,
  onAxisChange,
  onHeldChange,
  onPulseAction,
  onCycleTool,
  onSelectTool,
}: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [purrToggled, setPurrToggled] = useState(false);
  const [crouchToggled, setCrouchToggled] = useState(false);

  const updateStick = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onAxisChange(-dy / maxR, dx / maxR);
  };

  const resetStick = () => {
    activePointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onAxisChange(0, 0);
  };

  const activeSpec = TOOL_SPECS[activeTool];
  const activeToolCd = toolCooldowns[activeTool] ?? 0;

  const toolQuickStrip = compact ? (
    <div
      data-testid="weapon-hotbar"
      className="pointer-events-auto flex items-center gap-1 bg-[#121C20]/88 border border-[#8F5E46]/70 p-1 shadow-md touch-none"
    >
      {TOOL_ORDER.map((toolId, idx) => {
        const isActive = activeTool === toolId;
        const cdPct = toolCooldowns[toolId] ?? 0;
        const spec = TOOL_SPECS[toolId];
        const tLocale = locale.tools[toolId];
        return (
          <button
            key={toolId}
            type="button"
            tabIndex={-1}
            data-testid={`tool-slot-${toolId}`}
            aria-label={tLocale.name}
            title={`${tLocale.name}: ${tLocale.effect}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectTool(toolId);
            }}
            className={`relative w-9 h-8 flex items-center justify-center border cursor-pointer transition-colors ${
              isActive
                ? 'bg-[#25322F] border-[#F4A949] text-[#F7EEDC]'
                : 'bg-[#172226] border-[#8F5E46]/45 text-[#9EB4AD]'
            }`}
          >
            <span className="absolute top-0.5 left-1 text-[8px] font-mono leading-none text-[#F4A949]/90">
              {idx + 1}
            </span>
            <ToolSvgIcon
              toolId={toolId}
              color={isActive ? spec.accentHex : '#9EB4AD'}
              className="w-3.5 h-3.5 shrink-0 mt-0.5"
            />
            {cdPct > 0.02 && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0F171A]">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round(cdPct * 100)}%`,
                    backgroundColor: spec.accentHex,
                  }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  const btnSecondaryH = landscape ? 'h-8' : compact ? 'h-9' : 'h-10';
  const btnPrimaryH = landscape ? 'h-10' : 'h-11';

  return (
    <div
      data-testid="touch-controls-overlay"
      className="w-full pointer-events-none flex flex-col gap-1.5 px-0.5 sm:px-2 pb-0.5"
    >
      {/* Portrait compact screens place the 4-icon tool selector cleanly centered above thumb zones */}
      {compact && !landscape && <div className="flex justify-center">{toolQuickStrip}</div>}

      <div className="w-full pointer-events-none flex items-end justify-between gap-2">
        {/* Left Floating Analog Joystick */}
        <div
          ref={padRef}
          role="application"
          aria-label="Virtual movement joystick"
          onPointerDown={(e) => {
            e.stopPropagation();
            activePointerRef.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (activePointerRef.current !== e.pointerId) return;
            updateStick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (activePointerRef.current === e.pointerId) {
              if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              resetStick();
            }
          }}
          onPointerCancel={resetStick}
          className={`pointer-events-auto relative bg-[#121C20]/80 border-2 border-[#8F5E46]/80 touch-none flex items-center justify-center shadow-lg shrink-0 ${
            compact ? 'w-24 h-24' : 'w-28 h-28 sm:w-32 sm:h-32'
          }`}
        >
          <div
            className={`${compact ? 'w-14 h-14' : 'w-16 h-16'} border border-[#8F5E46]/35 pointer-events-none`}
          />
          <div
            className={`absolute ${
              compact ? 'w-9 h-9' : 'w-11 h-11'
            } bg-[#F4A949]/90 border-2 border-[#FFD5A5] shadow-md pointer-events-none`}
            style={{
              transform: `translate(${knob.x}px, ${knob.y}px)`,
            }}
          />
        </div>

        {/* Landscape phone centers the 4-icon tool quick strip between thumbs so height stays minimal */}
        {compact && landscape && <div className="mb-0.5">{toolQuickStrip}</div>}

        {/* Right Ergonomic Action Cluster */}
        <div
          className={`pointer-events-auto grid grid-cols-3 touch-none shrink-0 ${
            compact ? 'gap-1 w-[168px]' : 'gap-1 sm:gap-1.5'
          }`}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPulseAction('dash');
            }}
            className={`relative ${btnSecondaryH} px-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider border cursor-pointer truncate ${
              dashActive
                ? 'bg-[#1C4549] border-[#6FE6D6] text-[#FFFFFF]'
                : 'bg-[#15353B]/90 border-[#6FE6D6]/85 text-[#D8FFF8]'
            }`}
          >
            <span>{locale.actions.touchDash}</span>
            {dashCooldownPct > 0.02 && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#6FE6D6]"
                style={{ width: `${Math.round(dashCooldownPct * 100)}%` }}
              />
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPulseAction('sense');
            }}
            className={`relative ${btnSecondaryH} px-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider border cursor-pointer truncate ${
              senseActive
                ? 'bg-[#463616] border-[#FFD57E] text-[#FFF4DC]'
                : 'bg-[#2C2415]/90 border-[#FFD57E]/85 text-[#FFE8C2]'
            }`}
          >
            <span>{locale.actions.touchSense}</span>
            {senseCooldownPct > 0.02 && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FFD57E]"
                style={{ width: `${Math.round(senseCooldownPct * 100)}%` }}
              />
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onCycleTool();
            }}
            className={`${btnSecondaryH} px-1.5 text-[10px] font-mono uppercase tracking-wider bg-[#121C20]/85 border border-[#8F5E46]/80 text-[#F4A949] cursor-pointer truncate`}
          >
            {locale.actions.touchNextTool}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !crouchToggled;
              setCrouchToggled(next);
              onHeldChange('crouch', next);
            }}
            className={`${btnSecondaryH} px-1.5 text-[10px] font-mono uppercase tracking-wider border cursor-pointer truncate ${
              crouching || crouchToggled
                ? 'bg-[#3F7D70] border-[#8FE8CF] text-[#F7EEDC]'
                : 'bg-[#121C20]/85 border-[#8F5E46]/80 text-[#EFE6D5]'
            }`}
          >
            {locale.actions.touchCrouch}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !purrToggled;
              setPurrToggled(next);
              onHeldChange('purr', next);
            }}
            className={`${btnSecondaryH} px-1.5 text-[10px] font-mono uppercase tracking-wider border cursor-pointer truncate ${
              purring || purrToggled
                ? 'bg-[#6E4924] border-[#F4A949] text-[#FFE8C2]'
                : 'bg-[#121C20]/85 border-[#8F5E46]/80 text-[#EFE6D5]'
            }`}
          >
            {locale.actions.touchPurr}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPulseAction('interact');
            }}
            className={`${btnSecondaryH} px-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider border cursor-pointer truncate ${
              hasNearbyPrompt
                ? 'bg-[#2B5349] border-[#4CE0B3] text-[#FFFFFF]'
                : 'bg-[#1D3530]/90 border-[#6EA89C] text-[#F7EEDC]'
            }`}
          >
            {locale.actions.touchAct}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPulseAction('chime');
            }}
            className={`relative ${btnPrimaryH} px-1 flex items-center justify-center gap-0.5 text-[10px] font-mono font-semibold uppercase tracking-normal bg-[#784A1E]/92 border border-[#F4A949] text-[#FFE8C2] cursor-pointer`}
          >
            <ToolSvgIcon toolId={activeTool} color={activeSpec.accentHex} className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{locale.actions.touchTool}</span>
            {activeToolCd > 0.02 && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5"
                style={{
                  width: `${Math.round(activeToolCd * 100)}%`,
                  backgroundColor: activeSpec.accentHex,
                }}
              />
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPulseAction('jump');
              onHeldChange('glide', true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onHeldChange('glide', false);
            }}
            onPointerCancel={() => onHeldChange('glide', false)}
            className={`col-span-2 ${btnPrimaryH} px-2.5 text-xs font-mono font-bold uppercase tracking-wider border cursor-pointer ${
              gliding || targetLedgeReady
                ? 'bg-[#FFD57E] border-[#8FE8CF] text-[#142024]'
                : 'bg-[#F4A949] border-[#FFD5A5] text-[#142024]'
            }`}
          >
            {locale.actions.touchJump}
          </button>
        </div>
      </div>
    </div>
  );
}
