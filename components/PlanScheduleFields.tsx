"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { validDate } from "@/lib/broadcast-catalog";
import { displayPlanDate, formatBudgetInput, parseBudgetInput, parsePlanDate } from "@/lib/brief-inputs";
import styles from "./PlanScheduleFields.module.css";

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const isoDay = (day: Date) => day.toISOString().slice(0, 10);
const utcDate = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function PlanScheduleFields({ initialStart = "", initialEnd = "", initialBudget, showBudget = true }: { initialStart?: string; initialEnd?: string; initialBudget?: number | null; showBudget?: boolean }) {
  const [start, setStart] = useState(validDate(initialStart) ? initialStart : "");
  const [end, setEnd] = useState(validDate(initialEnd) ? initialEnd : "");
  return <>
    <CalendarDateField name="startDate" label="Inicio" value={start} onChange={setStart} max={end || undefined}/>
    <CalendarDateField name="endDate" label="Fin" value={end} onChange={setEnd} min={start || undefined}/>
    {showBudget && <BudgetField initialValue={initialBudget} required/>}
  </>;
}

export function CalendarDateField({ name, label, value, onChange, min, max, required = true }: {
  name: string; label: string; value: string; onChange: (value: string) => void; min?: string; max?: string; required?: boolean;
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(displayPlanDate(value)), [open, setOpen] = useState(false);
  const reportedValue = useRef(value);
  const [month, setMonth] = useState(() => (value || min || new Date().toISOString().slice(0, 10)).slice(0, 7));
  const [focused, setFocused] = useState(value || "");
  const outOfRange = Boolean(value && (min && value < min || max && value > max));
  const validation = display && !parsePlanDate(display) ? "Escribe una fecha válida: día/mes/año." : outOfRange ? "La fecha de fin debe ser igual o posterior a la fecha de inicio." : "";
  useEffect(() => { input.current?.setCustomValidity(validation); }, [validation]);
  useEffect(() => {
    if (reportedValue.current === value) return;
    reportedValue.current = value;
    setDisplay(displayPlanDate(value));
    if (validDate(value)) setMonth(value.slice(0, 7));
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const first = utcDate(`${month}-01`), offset = (first.getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  const allowed = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  function moveMonth(delta: number) {
    const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(isoDay(next).slice(0, 7)); setFocused("");
  }
  function pick(iso: string) { reportedValue.current = iso; onChange(iso); setDisplay(displayPlanDate(iso)); setOpen(false); input.current?.focus(); }
  function keyMove(event: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
    if (delta == null) return;
    event.preventDefault(); const date = utcDate(iso); date.setUTCDate(date.getUTCDate() + delta);
    const next = isoDay(date); if (!allowed(next)) return;
    setMonth(next.slice(0, 7)); setFocused(next);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  }
  const firstAllowed = Array.from({ length: dayCount }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`).find(allowed);
  return <div className={styles.field} ref={root} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); input.current?.focus(); } }}>
    <label htmlFor={id}>{label}</label>
    <input type="hidden" name={name} value={value}/>
    <div className={styles.inputWrap}>
      <input id={id} ref={input} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" value={display} maxLength={10} required={required} aria-describedby={validation ? `${id}-error` : undefined} aria-invalid={validation ? true : undefined} onChange={event => { setDisplay(event.target.value); const iso = parsePlanDate(event.target.value); reportedValue.current = iso; onChange(iso); if (iso) setMonth(iso.slice(0, 7)); }}/>
      <button type="button" className={styles.calendarButton} aria-label={`Abrir calendario de ${label.toLowerCase()}`} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => { if (!open) { setMonth((value || min || new Date().toISOString().slice(0, 10)).slice(0, 7)); setFocused(value); } setOpen(!open); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/></svg></button>
    </div>
    {validation && <small className={styles.error} id={`${id}-error`}>{validation}</small>}
    {open && <div className={styles.calendar} id={`${id}-calendar`} role="dialog" aria-label={`Seleccionar fecha de ${label.toLowerCase()}`}>
      <header><button type="button" aria-label="Mes anterior" onClick={() => moveMonth(-1)}>←</button><strong aria-live="polite">{months[first.getUTCMonth()]} {first.getUTCFullYear()}</strong><button type="button" aria-label="Mes siguiente" onClick={() => moveMonth(1)}>→</button></header>
      <div className={styles.weekdays} aria-hidden="true">{["L", "M", "X", "J", "V", "S", "D"].map(day => <span key={day}>{day}</span>)}</div>
      <div className={styles.days}>{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`}/>)}{Array.from({ length: dayCount }, (_, index) => {
        const day = `${month}-${String(index + 1).padStart(2, "0")}`, selected = value === day;
        const tabDay = focused && focused.startsWith(month) && allowed(focused) ? focused : firstAllowed;
        return <button key={day} type="button" data-day={day} aria-label={displayPlanDate(day)} aria-pressed={selected} disabled={!allowed(day)} tabIndex={tabDay === day ? 0 : -1} onKeyDown={event => keyMove(event, day)} onFocus={() => setFocused(day)} onClick={() => pick(day)}>{index + 1}</button>;
      })}</div>
      <footer><span>Día / mes / año</span><button type="button" onClick={() => { setOpen(false); input.current?.focus(); }}>Cerrar</button></footer>
    </div>}
  </div>;
}

export function BudgetField({ initialValue, value, onValueChange, name = "budget", label = "Presupuesto antes de impuestos (USD)", placeholder = "3.000,00", required = false }: {
  initialValue?: number | null; value?: number | null; onValueChange?: (amount: number | null) => void;
  name?: string; label?: string; placeholder?: string; required?: boolean;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const initial = value ?? initialValue;
  const [display, setDisplay] = useState(initial != null && initial > 0 ? formatBudgetInput(initial) : "");
  const reportedValue = useRef<number | null | undefined>(initial);
  const amount = parseBudgetInput(display), invalid = display.trim() !== "" && amount == null;
  useEffect(() => { input.current?.setCustomValidity(invalid ? "Escribe un importe válido. Ejemplo: 100.000,00" : ""); }, [invalid]);
  useEffect(() => {
    if (value === undefined || (reportedValue.current ?? 0) === (value ?? 0)) return;
    reportedValue.current = value;
    setDisplay(value != null && value > 0 ? formatBudgetInput(value) : "");
  }, [value]);
  return <div className={styles.field}><label htmlFor={id}>{label}</label><div className={`${styles.inputWrap} ${styles.budget}`}><span aria-hidden="true">$</span><input id={id} ref={input} type="text" inputMode="decimal" value={display} placeholder={placeholder} maxLength={22} required={required} aria-invalid={invalid ? true : undefined} onChange={event => { setDisplay(event.target.value); const next = parseBudgetInput(event.target.value); reportedValue.current = next; onValueChange?.(next); }} onBlur={() => { if (amount != null) setDisplay(formatBudgetInput(amount)); }}/></div><input name={name} type="hidden" value={amount == null ? "" : amount.toFixed(2)}/>{invalid && <small className={styles.error}>Usa punto para miles y coma para centavos.</small>}</div>;
}
