import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { GraphConfig, SERIES_COLORS } from '@/types';

export const runtime = 'nodejs';

const SYSTEM = `Si pomočnik slovenskega učitelja fizike (8. in 9. razred). Iz opisa učitelja pripravi graf, ki ga prikaže aplikacija Grafikograf.
Pravila:
- Oznake osi v obliki "t [s]", "v [m/s]", "s [m]", "T [°C]" ... (slovenske fizikalne oznake).
- Podaj realne, preproste številske točke (celi ali kratki decimalni zapisi), ki ustrezajo opisu (npr. enakomerno gibanje = premica, enakomerno pospešeno = parabola s hitrostjo ali potjo ...).
- Točke naj bodo urejene po naraščajočem x. Običajno 4–12 točk na serijo, največ 5 serij.
- smooth = true samo za dejansko ukrivljene krivulje, za premice in lomljene črte false.
- Meje osi (x_min, x_max, y_min, y_max) naj bodo lepe okrogle številke, ki zajamejo vse točke; min naj bo 0, če so vrednosti nenegativne.
- Če opis ne vsebuje številk, si jih razumno izmisli.
- Brezdimenzijski (simbolni) grafi: če naloga govori o simbolih (t1, t2, s_k ...) brez številskih vrednosti, nastavi hide_numbers=true in hide_grid=true, izberi poljubne primerne številke za risanje (npr. t1=2, t2=3·t1=6) in pri ustreznih točkah nastavi x_name / y_name s simboli. Indeks piši s podčrtajem: "t_1", "t_2", "s_k". Oznaka se izriše na osi s črtkano projekcijo točke. Točke, ki ležijo na isti višini, dobijo isti y_name.
- Vsaka premica, ki izhaja iz izhodišča, naj bo svoja serija (vsaka serija ima točko (0,0)).
- Odgovori VEDNO samo s klicem orodja create_graph, brez besedila.`;

const TOOL: Anthropic.Tool = {
  name: 'create_graph',
  description: 'Ustvari graf za aplikacijo.',
  input_schema: {
    type: 'object',
    properties: {
      x_label: { type: 'string' },
      y_label: { type: 'string' },
      x_min: { type: 'number' },
      x_max: { type: 'number' },
      y_min: { type: 'number' },
      y_max: { type: 'number' },
      x_tick_step: { type: 'number', description: 'Korak številk na osi x (neobvezno)' },
      y_tick_step: { type: 'number', description: 'Korak številk na osi y (neobvezno)' },
      hide_numbers: { type: 'boolean', description: 'Skrij številke na oseh (simbolni graf)' },
      hide_grid: { type: 'boolean', description: 'Skrij mrežo' },
      series: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            smooth: { type: 'boolean' },
            points: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  x_name: { type: 'string', description: 'Simbolna oznaka na osi x, npr. t_1 (neobvezno)' },
                  y_name: { type: 'string', description: 'Simbolna oznaka na osi y, npr. s_k (neobvezno)' },
                },
                required: ['x', 'y'],
              },
            },
          },
          required: ['name', 'smooth', 'points'],
        },
      },
    },
    required: ['x_label', 'y_label', 'x_min', 'x_max', 'y_min', 'y_max', 'series'],
  },
};

interface ToolInput {
  x_label: string; y_label: string;
  x_min: number; x_max: number; y_min: number; y_max: number;
  x_tick_step?: number; y_tick_step?: number;
  hide_numbers?: boolean; hide_grid?: boolean;
  series: Array<{ name: string; smooth: boolean; points: Array<{ x: number; y: number; x_name?: string; y_name?: string }> }>;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Manjka ANTHROPIC_API_KEY. Dodaj ga v datoteko .env.local in znova zaženi strežnik.' },
      { status: 500 }
    );
  }

  let prompt = '';
  try {
    prompt = String((await req.json()).prompt ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Neveljavna zahteva.' }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: 'Opiši graf.' }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: 'Opis je predolg.' }, { status: 400 });

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 4096,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: prompt }],
    });

    const block = msg.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      return NextResponse.json({ error: 'AI ni vrnil grafa.' }, { status: 502 });
    }
    const t = block.input as ToolInput;
    if (!(t.x_max > t.x_min) || !(t.y_max > t.y_min) || !Array.isArray(t.series) || t.series.length === 0) {
      return NextResponse.json({ error: 'AI je vrnil neveljaven graf. Poskusi znova.' }, { status: 502 });
    }

    const graph: Partial<GraphConfig> = {
      x_label: t.x_label,
      y_label: t.y_label,
      x_min: t.x_min, x_max: t.x_max, y_min: t.y_min, y_max: t.y_max,
      x_tick_step: t.x_tick_step && t.x_tick_step > 0 ? t.x_tick_step : undefined,
      y_tick_step: t.y_tick_step && t.y_tick_step > 0 ? t.y_tick_step : undefined,
      hide_numbers: !!t.hide_numbers,
      hide_x_numbers: undefined,
      hide_y_numbers: undefined,
      grid_mode: undefined,
      hide_grid: !!t.hide_grid,
      hidden_x_ticks: undefined,
      hidden_y_ticks: undefined,
      texts: undefined,
      x_label_pos: undefined,
      y_label_pos: undefined,
      series: t.series.slice(0, 5).map((s, i) => ({
        id: crypto.randomUUID(),
        name: s.name || `Serija ${i + 1}`,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        smooth: !!s.smooth,
        data_points: s.points
          .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
          .map(p => ({
            id: crypto.randomUUID(), x: p.x, y: p.y,
            x_name: p.x_name || undefined, y_name: p.y_name || undefined,
          })),
      })),
    };
    return NextResponse.json({ graph });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Neznana napaka.';
    return NextResponse.json({ error: `Napaka pri klicu AI: ${message}` }, { status: 502 });
  }
}
