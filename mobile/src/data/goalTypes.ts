/**
 * Tipos de meta pré-definidos. Cada tipo já vem com um ícone; o nome do ícone é o mesmo
 * guardado em `Goal.icon` e traduzido em imagem pelo componente `GoalIcon`.
 */
export interface GoalType {
  label: string;
  /** Nome do ícone (chave de `GoalIcon`). */
  icon: string;
}

export const GOAL_TYPES: GoalType[] = [
  { label: 'Viagem', icon: 'Plane' },
  { label: 'Casa própria', icon: 'House' },
  { label: 'Carro', icon: 'CarFront' },
  { label: 'Reserva de emergência', icon: 'ShieldCheck' },
  { label: 'Estudos', icon: 'GraduationCap' },
  { label: 'Casamento', icon: 'Heart' },
  { label: 'Aposentadoria', icon: 'PiggyBank' },
  { label: 'Eletrônicos', icon: 'Smartphone' },
  { label: 'Saúde', icon: 'HeartPulse' },
];

/** Opção para metas que não estão na lista: a pessoa escreve o nome e escolhe o ícone. */
export const OTHER_GOAL = 'Outra';

/** Ícones oferecidos quando a meta é "Outra". */
export const ICON_CHOICES: string[] = [
  'Target', 'Gift', 'Laptop', 'Camera', 'Music', 'Dumbbell', 'Baby', 'Bike', 'Briefcase', 'Gem', 'Sparkles', 'Star',
];

/** Ícone usado quando o nome guardado não é reconhecido. */
export const DEFAULT_GOAL_ICON = 'Target';

/**
 * Descobre o tipo de uma meta já salva: é um tipo da lista se o ícone e o nome conferem com ele;
 * caso contrário, é uma meta "Outra" (ou um tipo da lista renomeado, que mantém o ícone).
 */
export function goalTypeOf(name: string, icon: string): string {
  const exact = GOAL_TYPES.find((type) => type.label === name && type.icon === icon);
  if (exact) return exact.label;
  const byIcon = GOAL_TYPES.find((type) => type.icon === icon);
  return byIcon ? byIcon.label : OTHER_GOAL;
}
