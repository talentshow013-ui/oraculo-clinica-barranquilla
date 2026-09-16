/**
 * Criterio del asesor sobre públicos para una clínica estética (no es dato del motor: es lo que
 * un director de marketing sabe y prueba). Cada entrada dice qué público, por qué, cómo armarlo en
 * Meta y con qué criterio de corte. El panel lo muestra aparte de los datos, rotulado como criterio,
 * y la clínica decide qué probar. Se ajusta con lo que digan los propios resultados.
 */
export interface CriterioPublico {
  id: string;
  publico: string;
  paraQue: string;
  porQue: string;
  comoArmarlo: string;
  corte: string;
  /** Servicios de la clínica donde más sentido tiene (ids de config/cliente.ts). */
  servicios: string[];
}

export const CRITERIOS_PUBLICO: ReadonlyArray<CriterioPublico> = [
  {
    id: "remarketing_ig_365",
    publico: "Quienes ya interactuaron con la clínica (Instagram y Facebook, 365 días)",
    paraQue: "Convertir a los que ya te conocen: es el público más barato que existe para una clínica.",
    porQue: "La decisión de un procedimiento estético toma semanas. Quien ya vio un video, comentó o guardó una publicación está a mitad de camino; volver a hablarle con la oferta cuesta una fracción de traer a alguien nuevo.",
    comoArmarlo: "Público personalizado: «Personas que interactuaron con la cuenta de Instagram» + «con la página de Facebook», 365 días. Excluir a quienes ya escribieron por WhatsApp en los últimos 30 días.",
    corte: "Si a los 14 días el costo por conversación no queda por debajo del de la cuenta, el problema es la oferta, no el público.",
    servicios: ["criolipolisis", "hifu", "laser_facial"],
  },
  {
    id: "similar_conversaciones",
    publico: "Parecidos a quienes ya escribieron (similar 1–3 % de las conversaciones de WhatsApp)",
    paraQue: "Escalar a públicos fríos sin perder la calidad de los que ya convirtieron.",
    porQue: "Meta encuentra gente con el mismo perfil de quien ya escribió. Un similar del 1 % es el público frío más parecido a tus pacientes reales; el 3 % da más volumen con menos precisión.",
    comoArmarlo: "Origen: público personalizado «Conversaciones de WhatsApp iniciadas» (90 días). Similar 1 % y otro 3 %, Colombia; luego se limita al radio de la clínica. Excluir el origen.",
    corte: "El 1 % debe salir más barato que el 3 %; si no, la semilla es pequeña (menos de 500 personas) y hay que esperar a juntar más conversaciones.",
    servicios: ["criolipolisis", "hifu", "laser_facial", "lipoz360"],
  },
  {
    id: "mujeres_30_55_radio",
    publico: "Mujeres de 30 a 55 años, a 10–15 km de la clínica",
    paraQue: "El corazón de la demanda de estética facial y corporal, sin pagar por gente que no puede venir.",
    porQue: "Los resultados propios muestran que las conversiones se concentran entre 30 y 55 años y en mujeres; el radio evita pagar por Cartagena, Bogotá o quien no va a viajar por una sesión.",
    comoArmarlo: "Edad 30–55, mujeres, ubicación «personas que viven en» un radio de 10–15 km alrededor de la clínica (no «visitan recientemente»). Sin intereses: Advantage+ desactivado en edad y ubicación para que no lo amplíe.",
    corte: "Comparar contra el mismo anuncio a 18–65 y ambos géneros durante 14 días; se queda el que dé conversaciones más baratas con al menos 50 resultados cada uno.",
    servicios: ["criolipolisis", "hifu", "laser_facial", "tensapro"],
  },
  {
    id: "zonas_alto_valor",
    publico: "Zonas de alto valor: norte de Barranquilla y Puerto Colombia",
    paraQue: "Concentrar la plata donde está la capacidad de pago para procedimientos de varios millones.",
    porQue: "Un radio parejo alrededor de la clínica mezcla barrios con capacidad de pago muy distinta. Pines de 2–3 km sobre Alto Prado, Villa Country, Villa Campestre, Buenavista y Puerto Colombia compran el mismo mensaje a gente que sí cierra.",
    comoArmarlo: "Ubicación por pines (radio 2–3 km) sobre las zonas elegidas, «personas que viven en». Un conjunto aparte para medirlo contra el radio general.",
    corte: "Si el costo por conversación es mayor pero la clínica reporta más citas asistidas por conversación, gana este; por eso hace falta anotar resultados en Campañas.",
    servicios: ["hifu", "laser_facial", "packdual"],
  },
  {
    id: "mamas_posparto",
    publico: "Mamás con hijos pequeños (posparto 1–3 años)",
    paraQue: "Criolipólisis, lipo en frío y firmeza corporal: el problema concreto de «no vuelvo a mi cuerpo».",
    porQue: "La clínica ya tiene un cluster «mamá primeriza» con conversaciones a buen costo; el mensaje «sin incapacidad, sigues con tu ritmo de vida» le habla directo a quien no puede parar por un hijo.",
    comoArmarlo: "Edad 25–45, mujeres; segmentación detallada «Padres con hijos pequeños (1–2 años)» y «(3–5 años)»; radio 15 km. Creativo específico de mamás, no el general.",
    corte: "14 días o 50 conversaciones; se compara el costo con el conjunto general de criolipólisis.",
    servicios: ["criolipolisis", "lipoz360", "tensapro"],
  },
  {
    id: "hombres_corporal",
    publico: "Hombres de 30 a 55 años para corporal",
    paraQue: "Un público casi sin competencia en Barranquilla: nadie del radar les habla.",
    porQue: "En el radar de 53 competidores casi ningún anuncio nombra a los hombres; el anuncio propio «La grasa localizada también afecta a los hombres» convirtió a $2.855, por debajo de la cuenta. Subasta más barata y mensaje nuevo.",
    comoArmarlo: "Edad 30–55, hombres, radio 15 km, intereses opcionales (gimnasio, crossfit). Creativo con hombre a cámara; nunca el mismo video de mujeres.",
    corte: "Costo por conversación por debajo de la cuenta con 50 resultados; si el volumen es bajo pero el costo bueno, se deja con presupuesto pequeño y constante.",
    servicios: ["criolipolisis", "lipoz360"],
  },
  {
    id: "advantage_con_creativo_probado",
    publico: "Advantage+ (Meta elige) solo con un anuncio ya probado",
    paraQue: "Volumen barato cuando ya se sabe qué anuncio convierte.",
    porQue: "Advantage+ funciona cuando el anuncio le dice a Meta a quién buscar; con un anuncio nuevo sin señal, amplía a cualquiera. Los conjuntos Advantage+ de la clínica rinden bien cuando llevan el ganador de criolipólisis y mal cuando llevan pruebas.",
    comoArmarlo: "Público Advantage+ activado, edad mínima 25, ubicación radio 15 km; dentro solo el anuncio ganador y una variante. Nada de «testeo» en ese conjunto.",
    corte: "Si en 7 días la frecuencia pasa de 2 y el costo sube 20 %, el público se agotó: cambiar creativo, no público.",
    servicios: ["criolipolisis", "hifu"],
  },
  {
    id: "exclusiones",
    publico: "Exclusiones obligatorias en todos los conjuntos",
    paraQue: "Dejar de pagar dos veces por la misma persona.",
    porQue: "El 37 % de la pauta corre fuera de horario y varios conjuntos compran a la misma gente; excluir a quien ya escribió, a pacientes actuales y al público de otros conjuntos activos concentra la plata en gente nueva.",
    comoArmarlo: "Excluir: «Conversaciones de WhatsApp» 30 días, lista de pacientes (si la clínica la sube, sin datos sensibles), y el público personalizado del conjunto de remarketing en los conjuntos fríos.",
    corte: "La frecuencia de los conjuntos fríos debe bajar por debajo de 1,5 en dos semanas; si no, las exclusiones no están aplicadas.",
    servicios: ["criolipolisis", "hifu", "laser_facial", "lipoz360", "packdual", "tensapro"],
  },
];
