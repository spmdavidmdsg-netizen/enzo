#!/usr/bin/python3
"""Vistas previas de los correos de Enzo (mensual y semanal) para la página de revisión (dev/vista.html).

Diseño en modo claro con las reglas de la guía visual (diseno/guia-visual-enzo.html):
fondo gris papel, tarjetas blancas, tinta casi negra con jerarquía de grises, letra del sistema,
acento #1A73D9 en botones con texto blanco, verdes del Resumen y gris (no rojo) para lo no hecho.
Usa tus registros reales de pizarron-datos.json; la salida va a dev/correos/ (no se sube a GitHub).
Uso: python3 dev/correos.py [--mes AAAA-MM] [--semana AAAA-MM-DD]
"""
import argparse
import datetime
import html
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'pizarron-david'))
import enviar_reporte as er  # noqa: E402  (solo funciones y frases; no envía nada al importarse)

SALIDA = os.path.join(AQUI, 'correos')
APP = 'https://spmdavidmdsg-netizen.github.io/enzo/'

# ---- tokens de la guía (tema claro) ----
FUENTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif"
FONDO, TARJETA, BORDE = '#f2f4f7', '#ffffff', '#e4e8ee'
TINTA, TINTA2, TINTA3 = '#0b0d10', '#45484e', '#6b6f76'
ACENTO = '#1A73D9'
VERDES = ['#e6e9ee', '#c8e6b8', '#8fcb74', '#4f9a3a', '#2c6a1f']   # l0…l4 del Resumen claro
NO_HECHO = '#b9bec7'
TIPO_COLOR = {'sueno': '#6b6b75', 'trabajo': '#c9bcff', 'comida': '#ffc99a', 'avance': '#4a6cf7',
              'tarea': '#ffffff', 'ejercicio': '#bdeca6', 'recreativo': '#fdf5b0'}
MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
LETRA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
esc = html.escape


# ---------------------------------------------------------------- datos
def dia(log, f):
    items = log.get(f.isoformat(), {}).get('items', [])
    hechas = [x for x in items if x.get('done')]
    if not (items and hechas):
        return {'f': f, 'pct': None, 'crit': False, 'items': items}
    core = [x for x in items if x.get('core')]
    return {'f': f, 'pct': round(len(hechas) / len(items) * 100), 'crit': bool(core) and all(x.get('done') for x in core), 'items': items}


def resumen(dias):
    con = [d for d in dias if d['pct'] is not None]
    r = {'con': con, 'prom': round(sum(d['pct'] for d in con) / len(con)) if con else None,
         'crit': sum(1 for d in con if d['crit']), 'tipos': [], 'mejor': None, 'peor': None, 'racha': 0}
    if len(con) >= 2:
        r['mejor'] = max(con, key=lambda d: d['pct']); r['peor'] = min(con, key=lambda d: d['pct'])
        if r['mejor']['pct'] == r['peor']['pct']: r['mejor'] = r['peor'] = None
    t = {}
    for d in con:
        for x in d['items']:
            v = t.setdefault(x.get('type'), [0, 0]); v[0] += 1 if x.get('done') else 0; v[1] += 1
    r['tipos'] = sorted(((k, round(v[0] / v[1] * 100)) for k, v in t.items() if k in er.TIPOS), key=lambda x: -x[1])
    fechas = sorted(d['f'] for d in con); racha = 0; prev = None
    for f in fechas:
        racha = racha + 1 if prev and (f - prev).days == 1 else 1; prev = f; r['racha'] = max(r['racha'], racha)
    return r


def nivel(p):
    return 0 if p is None else 4 if p >= 100 else 3 if p >= 70 else 2 if p >= 40 else 1


# ---------------------------------------------------------------- piezas de correo (tablas, estilos en línea)
def doc(titulo_oculto, cuerpo):
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>{esc(titulo_oculto)}</title></head>
<body style="margin:0;padding:0;background:{FONDO};">
<div style="display:none;max-height:0;overflow:hidden;">{esc(titulo_oculto)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="{FONDO}" style="background:{FONDO};"><tr><td align="center" style="padding:32px 16px 40px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:{FUENTE};color:{TINTA};">
{cuerpo}
<tr><td align="center" style="padding:28px 0 0;color:{TINTA3};font-size:12px;line-height:1.5;">Enzo · tu organización diaria</td></tr>
</table></td></tr></table></body></html>"""


def fila(html_):
    return f'<tr><td style="padding:0 0 12px;">{html_}</td></tr>'


def tarjeta(contenido, pad='20px 22px'):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="{TARJETA}" '
            f'style="background:{TARJETA};border:1px solid {BORDE};border-radius:20px;"><tr><td style="padding:{pad};">{contenido}</td></tr></table>')


def encabezado(eyebrow, titulo):
    return (f'<tr><td style="padding:0 4px 20px;">'
            f'<p style="margin:0;color:{TINTA3};font-size:13px;font-weight:600;letter-spacing:.02em;">Enzo · {esc(eyebrow)}</p>'
            f'<h1 style="margin:4px 0 0;color:{TINTA};font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-.02em;">{esc(titulo)}</h1></td></tr>')


def seccion(t):
    return f'<p style="margin:0 0 12px;color:{TINTA3};font-size:13px;font-weight:600;">{esc(t)}</p>'


def pastilla(texto, positivo):
    bg, fg = ('#e3f2e2', '#24601c') if positivo else ('#eceef2', TINTA2)
    return f'<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:{bg};color:{fg};font-size:12px;font-weight:600;">{esc(texto)}</span>'


def heroe(prom, etiqueta, cambio):
    if prom is None:
        return tarjeta(f'<p style="margin:0;color:{TINTA2};font-size:15px;line-height:1.5;">Todavía no hay actividades marcadas en este periodo.</p>')
    cam = ''
    if cambio is not None:
        cam = pastilla('Igual que ' + etiqueta[1] if cambio == 0 else ('%+d puntos contra %s' % (cambio, etiqueta[1])), cambio > 0)
    barra = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>'
             f'<td bgcolor="{VERDES[0]}" style="background:{VERDES[0]};border-radius:999px;height:10px;font-size:0;line-height:0;">'
             f'<table role="presentation" width="{max(prom, 3)}%" cellpadding="0" cellspacing="0"><tr><td bgcolor="{VERDES[max(nivel(prom), 2)]}" style="background:{VERDES[max(nivel(prom), 2)]};border-radius:999px;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table>'
             f'</td></tr></table>')
    return tarjeta(f'<p style="margin:0;color:{TINTA3};font-size:13px;font-weight:600;">{esc(etiqueta[0])}</p>'
                   f'<p style="margin:2px 0 10px;color:{TINTA};font-size:56px;line-height:1;font-weight:700;letter-spacing:-.03em;">{prom}<span style="font-size:28px;letter-spacing:0;"> %</span></p>'
                   f'{cam}{barra}', '22px 22px 24px')


def datos(items):
    """Fila de cifras: [(valor, etiqueta), …] en celdas iguales."""
    ancho = '%d%%' % (100 // len(items))
    pad = lambda i: '0 6px 0 0' if i == 0 else '0 0 0 6px' if i == len(items) - 1 else '0 3px'
    celdas = ''.join(f'<td width="{ancho}" valign="top" style="padding:{pad(i)};">' + tarjeta(
        f'<p style="margin:0;color:{TINTA};font-size:22px;font-weight:700;letter-spacing:-.01em;">{esc(v)}</p>'
        f'<p style="margin:2px 0 0;color:{TINTA3};font-size:12px;line-height:1.35;">{esc(e)}</p>', '14px 14px') + '</td>' for i, (v, e) in enumerate(items))
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>{celdas}</tr></table>'


def barras_tipo(tipos):
    if not tipos:
        return ''
    filas = ''
    for k, p in tipos:
        fill = VERDES[max(nivel(p), 1)] if p else NO_HECHO
        filas += (f'<tr><td width="34%" style="padding:6px 0;color:{TINTA};font-size:14px;font-weight:600;white-space:nowrap;">'
                  f'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:{TIPO_COLOR.get(k, "#ccc")};border:1px solid rgba(15,30,50,.18);vertical-align:-1px;margin-right:8px;"></span>{esc(er.TIPOS[k])}</td>'
                  f'<td style="padding:6px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="{VERDES[0]}" style="background:{VERDES[0]};border-radius:999px;height:10px;font-size:0;line-height:0;">'
                  f'<table role="presentation" width="{max(p, 3)}%" cellpadding="0" cellspacing="0"><tr><td bgcolor="{fill}" style="background:{fill};border-radius:999px;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table></td>'
                  f'<td width="46" align="right" style="padding:6px 0;color:{TINTA2};font-size:13px;font-weight:600;">{p} %</td></tr>')
    return tarjeta(seccion('Por tipo de actividad') + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas}</table>')


def casilla(texto, p, crit, alto=44):
    bg = VERDES[nivel(p)]
    fg = '#ffffff' if nivel(p) >= 3 else TINTA
    anillo = f'border:2px solid {TINTA};' if crit else f'border:2px solid {bg};'
    return (f'<div style="height:{alto}px;border-radius:12px;background:{bg};{anillo}text-align:center;">'
            f'<div style="padding-top:{(alto - 18) // 2}px;color:{fg};font-size:13px;font-weight:700;line-height:14px;">{texto}</div></div>')


def leyenda():
    cuadros = ''.join(f'<span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:{c};vertical-align:-2px;margin-right:3px;"></span>' for c in VERDES)
    return (f'<p style="margin:14px 0 0;color:{TINTA3};font-size:12px;">Menos {cuadros} Más &nbsp;·&nbsp; '
            f'<span style="display:inline-block;width:10px;height:10px;border-radius:4px;border:2px solid {TINTA};vertical-align:-3px;"></span> Línea Crítica cumplida</p>')


def frase_y_boton(frase, texto, enlace):
    return (fila(tarjeta(f'<p style="margin:0;color:{TINTA};font-size:19px;line-height:1.4;font-weight:700;letter-spacing:-.01em;">{esc(frase)}</p>', '22px 22px'))
            + f'<tr><td align="center" style="padding:12px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>'
              f'<td align="center" bgcolor="{ACENTO}" style="background:{ACENTO};border-radius:999px;">'
              f'<a href="{esc(enlace, quote=True)}" target="_blank" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px;">{esc(texto)}</a>'
              f'</td></tr></table></td></tr>')


def mejor_peor(r, sufijo):
    if not r['mejor']:
        return ''
    def carta(t, d):
        return tarjeta(f'<p style="margin:0;color:{TINTA3};font-size:12px;font-weight:600;">{t}</p>'
                       f'<p style="margin:4px 0 0;color:{TINTA};font-size:17px;font-weight:700;">{esc(er.DIAS[d["f"].weekday()].capitalize())}{sufijo(d)}</p>'
                       f'<p style="margin:2px 0 0;color:{TINTA2};font-size:13px;">{d["pct"]} % cumplido</p>', '14px 16px')
    return fila(f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>'
                f'<td width="50%" valign="top" style="padding-right:6px;">{carta("Tu mejor día", r["mejor"])}</td>'
                f'<td width="50%" valign="top" style="padding-left:6px;">{carta("El que más te costó", r["peor"])}</td></tr></table>')


# ---------------------------------------------------------------- correos
def mensual(log, mes):
    y, m = map(int, mes.split('-'))
    n = (datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1)).day
    dias = [dia(log, datetime.date(y, m, i)) for i in range(1, n + 1)]
    r = resumen(dias)
    py, pm = (y - 1, 12) if m == 1 else (y, m - 1)
    pn = (datetime.date(y, m, 1) - datetime.timedelta(days=1)).day
    antes = resumen([dia(log, datetime.date(py, pm, i)) for i in range(1, pn + 1)])
    cambio = r['prom'] - antes['prom'] if r['prom'] is not None and antes['prom'] is not None else None

    hoy = datetime.date.today()
    cab = ''.join(f'<td align="center" style="padding:0 0 6px;color:{TINTA3};font-size:11px;font-weight:600;">{l}</td>' for l in LETRA)
    celdas, semana = [], [''] * ((datetime.date(y, m, 1).weekday()))
    for d in dias:
        if d['f'] > hoy:
            semana.append(f'<div style="height:40px;border-radius:12px;border:1px solid {BORDE};text-align:center;"><div style="padding-top:12px;color:{TINTA3};font-size:13px;font-weight:600;line-height:14px;">{d["f"].day}</div></div>')
        else:
            semana.append(casilla(str(d['f'].day), d['pct'], d['crit'], 40))
        if len(semana) == 7: celdas.append(semana); semana = []
    if semana: celdas.append(semana + [''] * (7 - len(semana)))
    cal = ''.join('<tr>' + ''.join(f'<td width="14%" style="padding:3px;">{c}</td>' for c in s) + '</tr>' for s in celdas)
    calendario = tarjeta(seccion('Tu mes, día por día') + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>{cab}</tr>{cal}</table>' + leyenda())

    frase = er.motivacion(r['prom'], mes)
    cifras = [(f"{len(r['con'])}", 'días registrados'), (f"{r['crit']} de {len(r['con'])}", 'con Línea Crítica cumplida'), (f"{r['racha']}", 'días de mejor racha')] if r['con'] else []
    cuerpo = (encabezado('Seguimiento del mes', er.nombre_mes(mes))
              + fila(heroe(r['prom'], ('Performance promedio', 'el mes pasado'), cambio))
              + (fila(datos(cifras)) if cifras else '')
              + fila(calendario)
              + mejor_peor(r, lambda d: ' %d' % d['f'].day)
              + (fila(barras_tipo(r['tipos'])) if r['tipos'] else '')
              + frase_y_boton(frase, 'Ver PDF del mes', '#'))
    return 'Seguimiento ' + er.nombre_mes(mes), doc('Tu mes en Enzo: ' + er.nombre_mes(mes), cuerpo)


def semanal(log, lunes):
    dias = [dia(log, lunes + datetime.timedelta(days=i)) for i in range(7)]
    r = resumen(dias)
    antes = resumen([dia(log, lunes - datetime.timedelta(days=7 - i)) for i in range(7)])
    cambio = r['prom'] - antes['prom'] if r['prom'] is not None and antes['prom'] is not None else None
    dom = lunes + datetime.timedelta(days=6)
    titulo = ('Del %d al %d de %s' % (lunes.day, dom.day, er.MESES[dom.month - 1].lower()) if lunes.month == dom.month
              else 'Del %d de %s al %d de %s' % (lunes.day, er.MESES[lunes.month - 1].lower(), dom.day, er.MESES[dom.month - 1].lower()))

    tira = ''.join(f'<td width="14%" valign="top" style="padding:0 3px;">'
                   f'<p style="margin:0 0 6px;text-align:center;color:{TINTA3};font-size:11px;font-weight:600;">{LETRA[i]}</p>'
                   + casilla(('%d%%' % d['pct']) if d['pct'] is not None else '—', d['pct'], d['crit'], 56) + '</td>'
                   for i, d in enumerate(dias))
    semana = tarjeta(seccion('Tu semana, día por día') + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>{tira}</tr></table>' + leyenda())

    foco = ''
    if r['tipos'] and len(r['tipos']) >= 2 and r['tipos'][-1][1] < r['tipos'][0][1]:
        k, p = r['tipos'][-1]
        foco = fila(tarjeta(f'<p style="margin:0;color:{TINTA3};font-size:12px;font-weight:600;">Para la semana que entra</p>'
                            f'<p style="margin:4px 0 0;color:{TINTA};font-size:17px;font-weight:700;">Dale prioridad a {esc(er.TIPOS[k].lower())}</p>'
                            f'<p style="margin:2px 0 0;color:{TINTA2};font-size:13px;line-height:1.45;">Fue lo que menos cumpliste esta semana ({p} %). Empieza por la de mañana.</p>', '16px 18px'))
    frase = er.motivacion(r['prom'], '2026-%02d' % (lunes.isocalendar()[1] % 12 + 1))
    cifras = [(f"{len(r['con'])} de 7", 'días registrados'), (f"{r['crit']} de {len(r['con'])}", 'con Línea Crítica cumplida')] if r['con'] else []
    cuerpo = (encabezado('Tu semana', titulo)
              + fila(heroe(r['prom'], ('Performance de la semana', 'la semana pasada'), cambio))
              + (fila(datos(cifras)) if cifras else '')
              + fila(semana)
              + mejor_peor(r, lambda d: '')
              + foco
              + (fila(barras_tipo(r['tipos'])) if r['tipos'] else '')
              + frase_y_boton(frase, 'Abrir Enzo', APP))
    asunto = 'Tu semana · %d–%d %s' % (lunes.day, dom.day, MES3[dom.month - 1])
    return asunto, doc('Tu semana en Enzo: ' + titulo.lower(), cuerpo)


def main():
    p = argparse.ArgumentParser()
    hoy = datetime.date.today()
    p.add_argument('--mes', default=hoy.strftime('%Y-%m'))
    p.add_argument('--semana', default=(hoy - datetime.timedelta(days=hoy.weekday() + (0 if hoy.weekday() == 6 else 7))).isoformat())
    a = p.parse_args()
    os.makedirs(SALIDA, exist_ok=True)
    with open(er.DATOS, encoding='utf-8') as f:
        log = json.load(f).get('monk', {}).get('log', {})
    as_m, html_m = mensual(log, a.mes)
    d = datetime.date.fromisoformat(a.semana)
    as_s, html_s = semanal(log, d - datetime.timedelta(days=d.weekday()))
    for nombre, contenido in (('mensual.html', html_m), ('semanal.html', html_s)):
        with open(os.path.join(SALIDA, nombre), 'w', encoding='utf-8') as f:
            f.write(contenido)
    with open(os.path.join(SALIDA, 'asuntos.json'), 'w', encoding='utf-8') as f:
        json.dump({'mensual': as_m, 'semanal': as_s}, f, ensure_ascii=False)
    print('Listo: dev/correos/mensual.html y dev/correos/semanal.html')


if __name__ == '__main__':
    main()
