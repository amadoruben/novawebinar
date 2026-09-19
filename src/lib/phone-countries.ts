/**
 * Indicativos telefónicos para o campo WhatsApp.
 * A pré-seleção vem da localização por endereço de rede (sem pedir permissão);
 * a pessoa pode sempre trocar de país na lista.
 */

export type PhoneCountry = {
  /** Código ISO de duas letras (para casar com a geolocalização por IP). */
  code: string;
  name: string;
  dial: string;
  flag: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "AO", name: "Angola", dial: "+244", flag: "🇦🇴" },
  { code: "MZ", name: "Moçambique", dial: "+258", flag: "🇲🇿" },
  { code: "CV", name: "Cabo Verde", dial: "+238", flag: "🇨🇻" },
  { code: "GW", name: "Guiné-Bissau", dial: "+245", flag: "🇬🇼" },
  { code: "ST", name: "S. Tomé e Príncipe", dial: "+239", flag: "🇸🇹" },
  { code: "TL", name: "Timor-Leste", dial: "+670", flag: "🇹🇱" },
  { code: "ES", name: "Espanha", dial: "+34", flag: "🇪🇸" },
  { code: "FR", name: "França", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Alemanha", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Itália", dial: "+39", flag: "🇮🇹" },
  { code: "GB", name: "Reino Unido", dial: "+44", flag: "🇬🇧" },
  { code: "IE", name: "Irlanda", dial: "+353", flag: "🇮🇪" },
  { code: "NL", name: "Países Baixos", dial: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Bélgica", dial: "+32", flag: "🇧🇪" },
  { code: "LU", name: "Luxemburgo", dial: "+352", flag: "🇱🇺" },
  { code: "CH", name: "Suíça", dial: "+41", flag: "🇨🇭" },
  { code: "AT", name: "Áustria", dial: "+43", flag: "🇦🇹" },
  { code: "SE", name: "Suécia", dial: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Noruega", dial: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Dinamarca", dial: "+45", flag: "🇩🇰" },
  { code: "FI", name: "Finlândia", dial: "+358", flag: "🇫🇮" },
  { code: "PL", name: "Polónia", dial: "+48", flag: "🇵🇱" },
  { code: "RO", name: "Roménia", dial: "+40", flag: "🇷🇴" },
  { code: "UA", name: "Ucrânia", dial: "+380", flag: "🇺🇦" },
  { code: "TR", name: "Turquia", dial: "+90", flag: "🇹🇷" },
  { code: "US", name: "Estados Unidos", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canadá", dial: "+1", flag: "🇨🇦" },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colômbia", dial: "+57", flag: "🇨🇴" },
  { code: "PE", name: "Peru", dial: "+51", flag: "🇵🇪" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { code: "UY", name: "Uruguai", dial: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguai", dial: "+595", flag: "🇵🇾" },
  { code: "MA", name: "Marrocos", dial: "+212", flag: "🇲🇦" },
  { code: "DZ", name: "Argélia", dial: "+213", flag: "🇩🇿" },
  { code: "SN", name: "Senegal", dial: "+221", flag: "🇸🇳" },
  { code: "NG", name: "Nigéria", dial: "+234", flag: "🇳🇬" },
  { code: "ZA", name: "África do Sul", dial: "+27", flag: "🇿🇦" },
  { code: "IN", name: "Índia", dial: "+91", flag: "🇮🇳" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japão", dial: "+81", flag: "🇯🇵" },
  { code: "AE", name: "Emirados Árabes", dial: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Austrália", dial: "+61", flag: "🇦🇺" },
  { code: "NZ", name: "Nova Zelândia", dial: "+64", flag: "🇳🇿" },
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = PHONE_COUNTRIES[0]!;

/** País cujo indicativo combina com o código ISO vindo da geolocalização. */
export function phoneCountryForIso(iso: string | null | undefined): PhoneCountry | undefined {
  if (!iso) return undefined;
  const wanted = iso.trim().toUpperCase();
  return PHONE_COUNTRIES.find((country) => country.code === wanted);
}
