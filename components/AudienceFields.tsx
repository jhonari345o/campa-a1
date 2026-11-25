"use client";

import { AUDIENCE_AGES, AUDIENCE_NSES, AUDIENCE_SEXES, DEFAULT_AUDIENCE, changeAudienceSelection, supportedAudienceSelection, type AudienceSelection } from "@/lib/audience-target";

/** The same named fields feed guided planning, DIY, saved briefs and analysis. */
export function AudienceFields({ value, onChange }: { value: AudienceSelection; onChange: (value: AudienceSelection) => void }) {
  return <>
    <label className="block min-w-0 text-sm font-black text-forest"><span className="block">Edad</span><select className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-fog px-3 py-2 text-sm font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/30" name="ageRange" value={value.ageRange} onChange={event => onChange(changeAudienceSelection(value, "ageRange", event.target.value))} required>
      {!value.ageRange && <option value="" disabled>Selecciona una edad</option>}
      {AUDIENCE_AGES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
    <label className="block min-w-0 text-sm font-black text-forest"><span className="block">Sexo</span><select className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-fog px-3 py-2 text-sm font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/30" name="sex" value={value.sex} onChange={event => onChange(changeAudienceSelection(value, "sex", event.target.value))} required>
      {!value.sex && <option value="" disabled>Selecciona el sexo</option>}
      {AUDIENCE_SEXES.map(option => <option key={option.value} value={option.value} disabled={!supportedAudienceSelection({ ...value, sex: option.value, socioeconomic: value.socioeconomic || DEFAULT_AUDIENCE.socioeconomic })}>{option.label}</option>)}
    </select></label>
    <label className="block min-w-0 text-sm font-black text-forest"><span className="block">Nivel socioeconómico</span><select className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-fog px-3 py-2 text-sm font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/30" name="socioeconomic" value={value.socioeconomic} onChange={event => onChange(changeAudienceSelection(value, "socioeconomic", event.target.value))} required>
      {!value.socioeconomic && <option value="" disabled>Selecciona el NSE</option>}
      {AUDIENCE_NSES.map(option => <option key={option.value} value={option.value} disabled={!supportedAudienceSelection({ ...value, sex: value.sex || DEFAULT_AUDIENCE.sex, socioeconomic: option.value })}>{option.label}</option>)}
    </select></label>
  </>;
}
