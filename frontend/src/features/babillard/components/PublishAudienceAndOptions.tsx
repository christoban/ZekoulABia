'use client';

import React from 'react';
import { AlertCircle, Clock, Pin } from 'lucide-react';
import { ROLE_LABELS_FR } from '../types';

interface PublishAudienceAndOptionsProps {
  allRoles: readonly string[];
  roles: string[];
  rolesError: string | null;
  onToggleRole: (role: string) => void;
  onSelectAllRoles: () => void;
  targetAllClasses: boolean;
  onSelectTargetAllClasses: (targetAll: boolean) => void;
  availableClasses: { id: string; name: string }[];
  selectedClasses: string[];
  onToggleClass: (classId: string) => void;
  duree: string;
  onDureeChange: (duree: string) => void;
  programmeeLe: string;
  onProgrammeeLeChange: (dateStr: string) => void;
  epinglee: boolean;
  onEpingleeChange: (pinned: boolean) => void;
}

export function PublishAudienceAndOptions({
  allRoles,
  roles,
  rolesError,
  onToggleRole,
  onSelectAllRoles,
  targetAllClasses,
  onSelectTargetAllClasses,
  availableClasses,
  selectedClasses,
  onToggleClass,
  duree,
  onDureeChange,
  programmeeLe,
  onProgrammeeLeChange,
  epinglee,
  onEpingleeChange,
}: PublishAudienceAndOptionsProps) {
  return (
    <>
      {/* 6. Public cible */}
      <div className="p-3.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-bold text-[var(--text)]">Public cible *</span>
          <button
            type="button"
            onClick={onSelectAllRoles}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Tous les rôles
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allRoles.map((r) => {
            const isSel = roles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => onToggleRole(r)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                  isSel
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--bg)]'
                }`}
              >
                {ROLE_LABELS_FR[r]}
              </button>
            );
          })}
        </div>
        {rolesError && (
          <p className="text-xs text-red-500 font-medium flex items-center gap-1">
            <AlertCircle size={12} /> {rolesError}
          </p>
        )}

        {/* Si Élèves ou Parents ciblés : option ciblage par classes */}
        {(roles.includes('STUDENT') || roles.includes('PARENT')) && (
          <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text)]">
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="targetClasses"
                  checked={targetAllClasses}
                  onChange={() => onSelectTargetAllClasses(true)}
                />
                Toutes les classes de l&apos;école
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="targetClasses"
                  checked={!targetAllClasses}
                  onChange={() => onSelectTargetAllClasses(false)}
                />
                Classes spécifiques
              </label>
            </div>

            {!targetAllClasses && (
              <div className="max-h-28 overflow-y-auto p-2 bg-[var(--surface)] rounded border border-[var(--border)] grid grid-cols-2 sm:grid-cols-3 gap-1">
                {availableClasses.map((cls) => {
                  const isChecked = selectedClasses.includes(cls.id);
                  return (
                    <label key={cls.id} className="flex items-center gap-1.5 text-[11.5px] cursor-pointer text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleClass(cls.id)}
                      />
                      <span className="truncate">{cls.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Options de visibilité & Programmation future */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)] text-xs text-[var(--text)]">
        <div>
          <label className="block font-bold text-[var(--text)] mb-1">Durée d&apos;affichage</label>
          <select
            value={duree}
            onChange={(e) => onDureeChange(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
          >
            <option value="PERMANENT">Permanent (Pas d&apos;expiration)</option>
            <option value="J3">3 jours</option>
            <option value="J7">7 jours (1 semaine)</option>
            <option value="J15">15 jours (2 semaines)</option>
            <option value="J30">30 jours (1 mois)</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-[var(--text)] mb-1 flex items-center gap-1">
            <Clock size={12} />
            Publication programmée
          </label>
          <input
            type="datetime-local"
            value={programmeeLe}
            onChange={(e) => onProgrammeeLeChange(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
          />
          <span className="text-[10.5px] text-[var(--text3)]">Laisser vide pour diffusion immédiate.</span>
        </div>

        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="pub-pin"
            checked={epinglee}
            onChange={(e) => onEpingleeChange(e.target.checked)}
            className="cursor-pointer"
          />
          <label htmlFor="pub-pin" className="cursor-pointer font-semibold text-[var(--text)] flex items-center gap-1">
            <Pin size={13} className="text-orange-500" />
            Épingler « À la une » en tête du babillard (max 3)
          </label>
        </div>
      </div>
    </>
  );
}

