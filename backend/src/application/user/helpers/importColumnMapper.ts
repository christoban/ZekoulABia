import type { ImportTargetType, ImportColumnMapping } from '../dto/ImportUserDtos';

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

interface FieldDefinition {
  targetField: string;
  aliases: string[];
  requiredFor: ImportTargetType[];
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    targetField: 'nom',
    aliases: ['nom', 'last_name', 'lastname', 'family_name', 'surname', 'nom_de_famille'],
    requiredFor: ['STUDENT', 'TEACHER', 'STAFF', 'PARENT', 'CLASSE'],
  },
  {
    targetField: 'prenom',
    aliases: ['prenom', 'prénom', 'first_name', 'firstname', 'given_name'],
    requiredFor: ['STUDENT', 'TEACHER', 'STAFF', 'PARENT'],
  },
  {
    targetField: 'email',
    aliases: ['email', 'e-mail', 'courriel', 'mail', 'email_address'],
    requiredFor: ['STUDENT', 'TEACHER', 'STAFF', 'PARENT'],
  },
  {
    targetField: 'telephone',
    aliases: ['telephone', 'téléphone', 'phone', 'tel', 'mobile', 'cellulaire', 'phone_number'],
    requiredFor: [],
  },
  {
    targetField: 'matricule',
    aliases: ['matricule', 'student_id', 'matricule_eleve', 'id_eleve', 'numero_matricule'],
    requiredFor: [],
  },
  {
    targetField: 'dateNaissance',
    aliases: ['date_naissance', 'date_de_naissance', 'dob', 'date_of_birth', 'birth_date', 'birthdate', 'date_naiss'],
    requiredFor: ['STUDENT'],
  },
  {
    targetField: 'sexe',
    aliases: ['sexe', 'sex', 'genre', 'gender'],
    requiredFor: ['STUDENT'],
  },
  {
    targetField: 'classe',
    aliases: ['classe', 'class', 'grade', 'classroom', 'salle_de_classe', 'classe_eleve'],
    requiredFor: ['STUDENT', 'TEACHER'],
  },
  {
    targetField: 'nomParent',
    aliases: ['nom_parent', 'parent_last_name', 'nom_pere', 'nom_mere', 'family_name_parent'],
    requiredFor: [],
  },
  {
    targetField: 'prenomParent',
    aliases: ['prenom_parent', 'parent_first_name', 'prenom_pere', 'prenom_mere', 'given_name_parent'],
    requiredFor: [],
  },
  {
    targetField: 'emailParent',
    aliases: ['email_parent', 'parent_email', 'mail_parent', 'e_mail_parent'],
    requiredFor: [],
  },
  {
    targetField: 'telephoneParent',
    aliases: ['telephone_parent', 'phone_parent', 'tel_parent', 'mobile_parent'],
    requiredFor: [],
  },
  {
    targetField: 'matieres',
    aliases: ['matieres', 'matières', 'subjects', 'subject', 'enseigne', 'matieres_enseignees'],
    requiredFor: ['TEACHER'],
  },
  {
    targetField: 'classePrincipale',
    aliases: ['classe_principale', 'classe_pp', 'main_class', 'professeur_principal_de', 'pp_class'],
    requiredFor: [],
  },
  {
    targetField: 'departementAp',
    aliases: ['departement_ap', 'departement_pedagogique', 'ap_departement', 'animation_pedagogique'],
    requiredFor: [],
  },
  {
    targetField: 'fonction',
    aliases: ['fonction', 'titre', 'role_staff', 'staff_title', 'title', 'poste', 'job_title', 'intitule_poste'],
    requiredFor: ['STAFF'],
  },
  {
    targetField: 'section',
    aliases: ['section', 'departement', 'service', 'unite_administrative'],
    requiredFor: [],
  },
  {
    targetField: 'matriculesEnfants',
    aliases: ['matricules_enfants', 'enfants_matricules', 'student_ids', 'children_ids', 'matricules_eleves', 'ids_enfants'],
    requiredFor: ['PARENT'],
  },
  {
    targetField: 'emailsEnfants',
    aliases: ['emails_enfants', 'children_emails', 'emails_eleves', 'emails_enfants'],
    requiredFor: ['PARENT'],
  },
  {
    targetField: 'pebs',
    aliases: ['pebs', 'pebs_filiere', 'filiere_pebs', 'programme_bilingue'],
    requiredFor: ['STUDENT'],
  },
  {
    targetField: 'lv2',
    aliases: ['lv2', 'langue_vivante_2', 'lv2_langue', 'seconde_langue'],
    requiredFor: ['STUDENT'],
  },
  {
    targetField: 'niveau',
    aliases: ['niveau', 'level', 'class_level', 'niveau_scolaire', 'niveau_classe'],
    requiredFor: ['CLASSE'],
  },
  {
    targetField: 'serie',
    aliases: ['serie', 'série', 'code_serie', 'stream', 'serie_classe'],
    requiredFor: ['CLASSE'],
  },
  {
    targetField: 'filiere',
    aliases: ['filiere', 'filière', 'code_filiere', 'track', 'filiere_classe'],
    requiredFor: ['CLASSE'],
  },
  {
    targetField: 'capacite',
    aliases: ['capacite', 'capacité', 'capacity', 'places', 'effectif_max', 'nb_places'],
    requiredFor: ['CLASSE'],
  },
];

export function getTargetFieldsForType(targetType: ImportTargetType): string[] {
  return FIELD_DEFINITIONS
    .filter((f) => f.requiredFor.includes(targetType) || f.requiredFor.length === 0)
    .map((f) => f.targetField);
}

export function buildAliasMap(): Map<string, string> {
  const aliasMap = new Map<string, string>();
  for (const field of FIELD_DEFINITIONS) {
    for (const alias of field.aliases) {
      const normalized = normalizeHeader(alias);
      if (!aliasMap.has(normalized)) {
        aliasMap.set(normalized, field.targetField);
      }
    }
  }
  return aliasMap;
}

const ALIAS_MAP = buildAliasMap();

export function detecterColumnMapping(
  headers: string[],
  targetType: ImportTargetType
): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  const targetFields = new Set(getTargetFieldsForType(targetType));

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const matchedField = ALIAS_MAP.get(normalized);
    if (matchedField && targetFields.has(matchedField)) {
      mapping[header] = matchedField;
    }
  }

  return mapping;
}

export function normalizeRowKeys(
  row: Record<string, string>,
  columnMapping: ImportColumnMapping
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [sourceKey, value] of Object.entries(row)) {
    const targetField = columnMapping[sourceKey];
    if (targetField) {
      normalized[targetField] = value;
    }
  }
  return normalized;
}