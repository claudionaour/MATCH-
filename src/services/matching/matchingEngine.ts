import {
  CommercialProduct,
  CompatibilityResult,
  JobVacancy,
  PurchaseRequest,
  WorkerProfile,
} from '../../types';

const EDUCATION_RANK: Record<WorkerProfile['educationLevel'], number> = {
  Basica: 1,
  Media: 2,
  Tecnico: 3,
  Universitario: 4,
  Postgrado: 5,
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Verifiable, rule-based explainable labor compatibility algorithm.
 * - Mandatory requirements (mandatorySkills, minExperienceYears, requiredEducation) are verified strictly.
 * - Never compensates missing mandatory requirements with high scores in other criteria.
 * - Zero discriminatory attributes are ever inspected or stored.
 */
export function computeJobCompatibility(worker: WorkerProfile, vacancy: JobVacancy): CompatibilityResult {
  const workerSkills = new Set(worker.skills.map(normalizeToken));
  const mandatory = vacancy.mandatorySkills.map(normalizeToken).filter(Boolean);
  const desired = vacancy.desiredSkills.map(normalizeToken).filter(Boolean);

  const failedMandatory: string[] = [];

  const missingMandatorySkills = mandatory.filter((req) => {
    const matched = Array.from(workerSkills).some((ws) => ws.includes(req) || req.includes(ws));
    return !matched;
  });

  if (missingMandatorySkills.length > 0) {
    failedMandatory.push(`Habilidades obligatorias faltantes: ${missingMandatorySkills.join(', ')}`);
  }

  if (worker.experienceYears < vacancy.minExperienceYears) {
    failedMandatory.push(
      `Requiere mínimo ${vacancy.minExperienceYears} años de experiencia (tienes ${worker.experienceYears})`
    );
  }

  if (EDUCATION_RANK[worker.educationLevel] < EDUCATION_RANK[vacancy.requiredEducation]) {
    failedMandatory.push(`Formación requerida: ${vacancy.requiredEducation}`);
  }

  // Skills score (max 30)
  const mandatoryScore =
    mandatory.length === 0
      ? 20
      : Math.round(((mandatory.length - missingMandatorySkills.length) / mandatory.length) * 20);
  const desiredMatches = desired.filter((d) =>
    Array.from(workerSkills).some((ws) => ws.includes(d) || d.includes(ws))
  ).length;
  const desiredScore = desired.length === 0 ? 10 : Math.round((desiredMatches / desired.length) * 10);
  const skills = mandatoryScore + desiredScore;

  // Experience score (max 15)
  const experience =
    worker.experienceYears >= vacancy.minExperienceYears
      ? Math.min(15, 10 + Math.min(5, worker.experienceYears - vacancy.minExperienceYears))
      : Math.round((worker.experienceYears / Math.max(1, vacancy.minExperienceYears)) * 8);

  // Education score (max 10)
  const education =
    EDUCATION_RANK[worker.educationLevel] >= EDUCATION_RANK[vacancy.requiredEducation] ? 10 : 3;

  // Location score (max 15)
  const location =
    normalizeToken(worker.commune) === normalizeToken(vacancy.commune)
      ? 15
      : normalizeToken(worker.region) === normalizeToken(vacancy.region)
        ? 10
        : vacancy.modality === 'remoto'
          ? 15
          : 3;

  // Availability score (max 10)
  const availability = worker.availability === 'inmediata' ? 10 : 7;

  // Schedule score (max 5)
  const schedule = worker.preferredSchedule === vacancy.schedule ? 5 : 2;

  // Modality score (max 10)
  const modality =
    worker.modality === vacancy.modality
      ? 10
      : worker.modality === 'hibrido' || vacancy.modality === 'hibrido'
        ? 6
        : 2;

  // Salary alignment (max 5)
  const salary =
    worker.salaryExpectationCLP === 0 ||
    (worker.salaryExpectationCLP >= vacancy.salaryMinCLP && worker.salaryExpectationCLP <= vacancy.salaryMaxCLP)
      ? 5
      : worker.salaryExpectationCLP <= vacancy.salaryMaxCLP * 1.15
        ? 3
        : 1;

  const rawTotal = skills + experience + education + location + availability + schedule + modality + salary;
  const eligible = failedMandatory.length === 0;
  // Cap non-eligible matches strictly below 60% so high secondary scores never mask failed mandatory criteria
  const score = eligible ? Math.min(100, rawTotal) : Math.min(55, rawTotal);

  const reasons: string[] = [];
  if (missingMandatorySkills.length === 0) reasons.push('tienes las habilidades solicitadas');
  if (worker.experienceYears >= vacancy.minExperienceYears) reasons.push('experiencia suficiente');
  if (location >= 10) reasons.push(`ubicación compatible (${vacancy.commune})`);
  if (modality >= 6) reasons.push(`modalidad ${vacancy.modality}`);
  if (availability >= 7) reasons.push('disponibilidad compatible');

  const explanation = eligible
    ? `${score}% de compatibilidad: ${reasons.join(', ')}.`
    : `${score}% de compatibilidad (no cumple requisitos obligatorios): ${failedMandatory.join('; ')}.`;

  return {
    eligible,
    score,
    explanation,
    failedMandatory,
    breakdown: {skills, experience, education, location, availability, schedule, modality, salary},
  };
}

/**
 * Bidirectional Commercial Matching score between a PurchaseRequest and a CommercialProduct.
 */
export function computeCommercialMatchScore(
  product: CommercialProduct,
  request: PurchaseRequest
): {score: number; explanation: string} {
  let score = 0;
  const reasons: string[] = [];

  if (normalizeToken(product.category) === normalizeToken(request.category)) {
    score += 40;
    reasons.push('misma categoría');
  }

  if (normalizeToken(product.commune) === normalizeToken(request.commune)) {
    score += 25;
    reasons.push(`en ${product.commune}`);
  } else if (normalizeToken(product.region) === normalizeToken(request.region)) {
    score += 15;
    reasons.push('misma región');
  }

  if (product.priceCLP >= request.minBudgetCLP && product.priceCLP <= request.maxBudgetCLP) {
    score += 20;
    reasons.push('dentro de presupuesto');
  } else if (product.priceCLP <= request.maxBudgetCLP * 1.2) {
    score += 10;
  }

  const reqWords = normalizeToken(request.title + ' ' + request.description)
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const prodText = normalizeToken(product.title + ' ' + product.description);
  const wordHits = reqWords.filter((w) => prodText.includes(w)).length;
  if (wordHits > 0) {
    score += Math.min(15, wordHits * 5);
    reasons.push('coincidencia directa en producto/servicio');
  }

  return {
    score: Math.min(100, score),
    explanation:
      reasons.length > 0
        ? `${Math.min(100, score)}% afinidad comercial: ${reasons.join(', ')}.`
        : 'Coincidencia exploratoria de mercado.',
  };
}
