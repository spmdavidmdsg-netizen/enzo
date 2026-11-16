#!/usr/bin/python3
"""Genera las vistas previas de los correos de Enzo para la página de revisión (dev/vista.html).

- Mensual: el correo que hoy envía la Mac (pizarron-david/enviar_reporte.py), con sus mismas funciones.
- Semanal: propuesta nueva, con el mismo estilo.
Usa tus registros reales de pizarron-datos.json; la salida va a dev/correos/ (no se sube a GitHub).
Uso: python3 dev/correos.py [--mes AAAA-MM] [--semana AAAA-MM-DD (cualquier día de la semana)]
"""
import argparse
import datetime
import html
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PIZARRON = os.path.join(AQUI, '..', '..', 'pizarron-david')
SALIDA = os.path.join(AQUI, 'correos')
APP = 'https://spmdavidmdsg-netizen.github.io/enzo/'
sys.path.insert(0, PIZARRON)
import enviar_reporte as er  # noqa: E402  (solo funciones; no envía nada al importarse)

MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
LETRA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
NIVEL = ['#26262c', '#234a1c', '#3f7f31', '#74bf5b', '#bdeca6']   # mismos verdes del Resumen (oscuro)


def nivel(p):
    return 0 if p is None else 4 if p >= 100 else 3 if p >= 70 else 2 if p >= 40 else 1


def dias_semana(log, lunes):
    out = []
    for i in range(7):
        f = lunes + datetime.timedelta(days=i)
        items = log.get(f.isoformat(), {}).get('items', [])
        hechas = [x for x in items if x.get('done')]
        if items and hechas:
            core = [x for x in items if x.get('core')]
            out.append({'f': f, 'pct': round(len(hechas) / len(items) * 100), 'crit': bool(core) and all(x.get('done') for x in core), 'items': items})
        else:
            out.append({'f': f, 'pct': None, 'crit': False, 'items': items})
    return out


def rango(lunes):
    dom = lunes + datetime.timedelta(days=6)
    if lunes.month == dom.month:
        return '%d al %d de %s' % (lunes.day, dom.day, er.MESES[dom.month - 1].lower())
    return '%d de %s al %d de %s' % (lunes.day, er.MESES[lunes.month - 1].lower(), dom.day, er.MESES[dom.month - 1].lower())


def semanal(log, lunes):
    dias = dias_semana(log, lunes)
    con = [d for d in dias if d['pct'] is not None]
    prom = round(sum(d['pct'] for d in con) / len(con)) if con else None
    antes = [d for d in dias_semana(log, lunes - datetime.timedelta(days=7)) if d['pct'] is not None]
    puntos = []
    if prom is None:
        puntos.append('Esta semana no tuvo actividades marcadas.')
    else:
        linea = 'Registraste %d de 7 días.' % len(con)
        puntos.append(linea)
        puntos.append('Línea Crítica cumplida en %d de %d días.' % (sum(1 for d in con if d['crit']), len(con)))
        if len(con) >= 2:
            alto = max(con, key=lambda d: d['pct']); bajo = min(con, key=lambda d: d['pct'])
            if alto['pct'] > bajo['pct']:
                puntos.append('Tu mejor día fue el %s (%d %%); el que más te costó, el %s (%d %%).' % (er.DIAS[alto['f'].weekday()], alto['pct'], er.DIAS[bajo['f'].weekday()], bajo['pct']))
        tipos = {}
        for d in con:
            for x in d['items']:
                t = tipos.setdefault(x.get('type'), [0, 0]); t[0] += 1 if x.get('done') else 0; t[1] += 1
        tipos = {k: v[0] / v[1] * 100 for k, v in tipos.items() if k in er.TIPOS}
        if len(tipos) >= 2 and max(tipos.values()) > min(tipos.values()):
            debil = min(tipos, key=tipos.get)
            puntos.append('Para la semana que entra: %s fue lo que menos cumpliste (%d %%).' % (er.TIPOS[debil], tipos[debil]))
    cambio = ''
    if prom is not None and antes:
        c = prom - round(sum(d['pct'] for d in antes) / len(antes))
        cambio = 'igual que la semana pasada' if c == 0 else '%+d puntos contra la semana pasada' % c
    frase = er.motivacion(prom, '2026-%02d' % (lunes.isocalendar()[1] % 12 + 1))
    celdas = ''.join(
        '<td align="center" style="padding:0 3px;">'
        '<div style="color:#a6a6ad;font-size:12px;font-weight:700;padding-bottom:6px;">%s</div>'
        '<div style="width:100%%;max-width:58px;height:58px;margin:0 auto;border-radius:12px;background:%s;%s">'
        '<div style="padding-top:20px;color:%s;font-size:13px;font-weight:800;">%s</div></div>'
        '<div style="height:12px;padding-top:6px;color:#ffffff;font-size:10px;">%s</div></td>' % (
            LETRA[i], NIVEL[nivel(d['pct'])], 'box-shadow:inset 0 0 0 1.5px #ffffff;' if d['crit'] else '',
            '#0b0b0c' if nivel(d['pct']) >= 3 else '#ffffff', ('%d%%' % d['pct']) if d['pct'] is not None else '—', '●' if d['crit'] else '')
        for i, d in enumerate(dias))
    filas = ''.join('<tr><td align="center" style="padding:0 0 12px;text-align:center;color:#e8e8ea;font-size:15px;line-height:1.5;">%s</td></tr>' % html.escape(p) for p in puntos)
    grande = ('<p style="margin:0;color:#ffffff;font-size:56px;font-weight:800;letter-spacing:-2px;line-height:1;">%d%%</p>'
              '<p style="margin:6px 0 0;color:#a6a6ad;font-size:13px;">Performance promedio%s</p>' % (prom, (' · ' + cambio) if cambio else '')) if prom is not None else ''
    asunto = 'Tu semana · %d–%d %s' % (lunes.day, (lunes + datetime.timedelta(days=6)).day, MES3[(lunes + datetime.timedelta(days=6)).month - 1])
    cuerpo = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#0c0d12" style="width:100%;max-width:560px;background:#0c0d12;background-image:linear-gradient(160deg,#20222c 0%,#0c0d12 45%,#000000 90%);border-radius:18px;">
<tr><td align="center" style="padding:34px 26px;text-align:center;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-1px;">Enzo</h1>
<p style="margin:4px 0 24px;color:#ffffff;font-size:18px;font-weight:700;">Semana del {html.escape(rango(lunes))}</p>
{grande}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 8px;table-layout:fixed;"><tr>{celdas}</tr></table>
<p style="margin:0 0 22px;color:#a6a6ad;font-size:11px;">● Línea Crítica cumplida</p>
<h2 style="margin:0 0 12px;color:#ffffff;font-size:17px;font-weight:800;">Tu semana</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">{filas}</table>
<p style="margin:14px 0 8px;color:#ffffff;font-size:19px;line-height:1.4;font-weight:700;">{html.escape(frase)}</p>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:24px auto 0;"><tr>
<td align="center" bgcolor="#ffffff" style="border-radius:999px;"><a href="{APP}" target="_blank" style="display:inline-block;padding:13px 28px;color:#111111;font-size:15px;font-weight:800;text-decoration:none;border-radius:999px;">Abrir Enzo</a></td></tr></table>
</td></tr></table>
</td></tr></table></body></html>"""
    return asunto, cuerpo


def main():
    p = argparse.ArgumentParser()
    hoy = datetime.date.today()
    p.add_argument('--mes', default=hoy.strftime('%Y-%m'))
    p.add_argument('--semana', default=(hoy - datetime.timedelta(days=hoy.weekday() + 7 if hoy.weekday() < 6 else hoy.weekday())).isoformat())
    a = p.parse_args()
    os.makedirs(SALIDA, exist_ok=True)
    with open(er.DATOS, encoding='utf-8') as f:
        log = json.load(f).get('monk', {}).get('log', {})

    an = er.analizar(a.mes)
    mensual = er.correo_html(a.mes, an['puntos'], er.motivacion(an['promedio'], a.mes), False, '#')
    mensual = mensual.replace('<html lang="es">', '<html lang="es"><head><meta charset="utf-8"></head>', 1)
    d = datetime.date.fromisoformat(a.semana); lunes = d - datetime.timedelta(days=d.weekday())
    asunto, sem = semanal(log, lunes)
    with open(os.path.join(SALIDA, 'mensual.html'), 'w', encoding='utf-8') as f: f.write(mensual)
    with open(os.path.join(SALIDA, 'semanal.html'), 'w', encoding='utf-8') as f: f.write(sem)
    with open(os.path.join(SALIDA, 'asuntos.json'), 'w', encoding='utf-8') as f:
        json.dump({'mensual': 'Seguimiento ' + er.nombre_mes(a.mes), 'semanal': asunto}, f, ensure_ascii=False)
    print('Listo: dev/correos/mensual.html y dev/correos/semanal.html')


if __name__ == '__main__':
    main()
