"use client";

import type { ReactNode } from "react";
import {
  AlertIcon,
  CheckIcon,
  HeartPulseIcon,
  PhoneIcon,
  PinIcon,
  SatelliteIcon,
  ShieldIcon,
  UsersIcon,
} from "@/app/components/icons";

const card =
  "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Chip({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: "zinc" | "red" | "amber";
}) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    red: "bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-200",
    amber:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200",
  };
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PersonInNeed() {
  return (
    <article className={card} aria-labelledby="victim-name">
      <div className="flex items-start gap-4 p-5">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-red-600 text-xl font-bold text-white">
          MD
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-red-700 uppercase dark:text-red-400">
            Person needing help
          </p>
          <h2 id="victim-name" className="text-xl font-semibold">
            Maria Delgado
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            67 yrs · Female · Speaks Spanish &amp; English
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="red">URGENT · Medical</Chip>
            <Chip tone="amber">Mobility: uses walker</Chip>
            <Chip>Medical ID shared</Chip>
          </div>
        </div>
      </div>

      <Section
        title="Medical ID"
        icon={<HeartPulseIcon width={14} height={14} />}
      >
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Blood type">
            <span className="text-lg font-bold text-red-700 dark:text-red-400">
              O+
            </span>
          </Field>
          <Field label="Weight / height">68 kg · 160 cm</Field>
          <Field label="Organ donor">Yes</Field>
          <Field label="Conditions">
            Type 2 diabetes (insulin), hypertension
          </Field>
          <Field label="Medications">
            Insulin glargine 20u nightly, lisinopril 10 mg
          </Field>
          <Field label="Allergies">
            <span className="text-red-700 dark:text-red-400">
              Penicillin (anaphylaxis)
            </span>
          </Field>
        </dl>
      </Section>

      <Section
        title="Location & household"
        icon={<PinIcon width={14} height={14} />}
      >
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Last known location">
            412 Bayshore Blvd, Apt 2B, Tampa
          </Field>
          <Field label="GPS">27.9312, -82.4818 · ±9 m</Field>
          <Field label="People with her">
            3 — husband (71, fall injury), grandson (9)
          </Field>
          <Field label="Pets">1 dog (Lucky, 30 lb)</Field>
        </dl>
      </Section>

      <Section
        title="Emergency contacts"
        icon={<PhoneIcon width={14} height={14} />}
      >
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-2">
            <span className="font-medium">Sofia Delgado (daughter)</span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              (813) 555-0142
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="font-medium">Dr. Alan Reyes (primary care)</span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              (813) 555-0199
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Device" icon={<SatelliteIcon width={14} height={14} />}>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="Battery">
            <span className="text-amber-700 dark:text-amber-400">23%</span>
          </Field>
          <Field label="Link">Direct-to-Cell</Field>
          <Field label="Messages sent">3</Field>
        </dl>
      </Section>
    </article>
  );
}

export function FirstResponder() {
  return (
    <article className={card} aria-labelledby="responder-name">
      <div className="flex items-start gap-4 p-5">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-xl font-bold text-white">
          JO
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-400">
            First responder
          </p>
          <h2 id="responder-name" className="text-xl font-semibold">
            Lt. James Okafor
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rescue Task Force 3 · Swiftwater Team Lead
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-500" /> En route
            </span>
            <Chip>Badge #4471</Chip>
          </div>
        </div>
      </div>

      <Section
        title="Current assignment"
        icon={<AlertIcon width={14} height={14} />}
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-semibold">
            Maria Delgado household — 412 Bayshore Blvd
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Possible fractured leg, insulin-dependent diabetic, rising water
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              ETA{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">
                14 min
              </strong>
            </span>
            <span>2.8 mi by high-water vehicle</span>
            <span>Assigned 3:31 PM</span>
          </div>
        </div>
      </Section>

      <Section
        title="Qualifications"
        icon={<ShieldIcon width={14} height={14} />}
      >
        <div className="flex flex-wrap gap-1.5">
          {[
            "Paramedic (NRP)",
            "Swiftwater Rescue Technician",
            "Hazmat Ops",
            "Incident Command 300",
            "Spanish (conversational)",
          ].map((q) => (
            <span
              key={q}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-800"
            >
              <CheckIcon width={12} height={12} className="text-emerald-600" />{" "}
              {q}
            </span>
          ))}
        </div>
      </Section>

      <Section
        title="Team & equipment"
        icon={<UsersIcon width={14} height={14} />}
      >
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Crew">4 (2 paramedics, 2 rescue techs)</Field>
          <Field label="Vehicle">
            High-water truck + 14 ft flat-bottom boat
          </Field>
          <Field label="Medical kit">ALS, insulin, splints, O₂</Field>
          <Field label="Radio / sat">Ch. 7 TAC · Starlink terminal</Field>
        </dl>
      </Section>

      <Section title="Shift" icon={<HeartPulseIcon width={14} height={14} />}>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="On duty">9h 12m</Field>
          <Field label="Rescues today">11</Field>
          <Field label="Queue">2 next</Field>
        </dl>
      </Section>
    </article>
  );
}

export default function ProfilesView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <CheckIcon width={18} height={18} />
        <p>
          <strong>Matched.</strong> Lt. Okafor has Maria&apos;s Medical ID,
          location and voice message. He&apos;s bringing insulin and a splint.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <PersonInNeed />
        <FirstResponder />
      </div>
    </div>
  );
}
