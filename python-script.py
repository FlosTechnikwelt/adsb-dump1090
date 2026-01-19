#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from PIL import Image, ImageDraw, ImageFont
import time
from waveshare_epd import epd2in7_V2

# --- API, Fonts & Display ---
URL = "http://127.0.0.1:3001/api/aircraft/current"
REFRESH_INTERVAL = 10
FONT_GROSS = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
FONT_KLEIN = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)


def get_api_data():
    """API laden"""
    try:
        r = requests.get(URL, timeout=10)
        r.raise_for_status()
        aircraft = r.json()
        return aircraft
    except requests.exceptions.RequestException as e:
        print("Fehler beim Abrufen der API-Daten:", e)
        return None


def rotate_and_show(epd, img):
    """Bild drehen und anzeigen"""
    img = img.rotate(90, expand=True)
    epd.display(epd.getbuffer(img))


def draw_aircraft_list(epd, aircraft):
    """Liste der Flugzeuge zeichnen"""
    img = Image.new('1', (epd.height, epd.width), 255)
    draw = ImageDraw.Draw(img)

    if aircraft is None:
        # Display 404 error
        text_404 = "404"
        # Use getbbox for modern Pillow versions
        left, top, right, bottom = FONT_GROSS.getbbox(text_404)
        text_width = right - left
        text_height = bottom - top
        x = (epd.height - text_width) / 2
        y = (epd.width - text_height) / 2
        draw.text((x, y), text_404, font=FONT_GROSS, fill=0)
    else:
        now = time.strftime("%H:%M:%S")
        draw.text((10, 5), f"Flugdaten Live", font=FONT_GROSS, fill=0)
        draw.line((10, 30, epd.height - 10, 30), fill=0)

        y_offset = 40
        max_display = 5

        if not aircraft:
            draw.text((10, y_offset), "Keine Flugzeuge in Sicht.", font=FONT_KLEIN, fill=0)
        else:
            for i, ac in enumerate(aircraft[:max_display]):
                flight = ac.get("flight", "N/A").strip()
                alt = ac.get("altitude", 0)
                gs = ac.get("speed", 0)

                # Stelle sicher, dass alt und gs Zahlen sind, bevor sie formatiert werden
                alt_text = f"{alt:.0f}ft" if isinstance(alt, (int, float)) else "N/A"
                gs_text = f"{gs:.0f}kt" if isinstance(gs, (int, float)) else "N/A"

                text = f"- {flight} | {alt_text} | {gs_text}"
                draw.text((10, y_offset + i * 25), text, font=FONT_KLEIN, fill=0)

    rotate_and_show(epd, img)


# ==========================
#   HAUPTPROGRAMM
# ==========================
if __name__ == "__main__":
    try:
        epd = epd2in7_V2.EPD()
        epd.init()
        epd.Clear()
        print("[DISPLAY] gestartet")

        while True:
            aircraft_data = get_api_data()
            draw_aircraft_list(epd, aircraft_data)
            time.sleep(REFRESH_INTERVAL)

    except ImportError:
        print("Waveshare EPD-Bibliothek nicht gefunden. Führen Sie 'pip install waveshare-epd' aus.")
    except KeyboardInterrupt:
        print("Programm beendet.")
    except Exception as e:
        print(f"Ein unerwarteter Fehler ist aufgetreten: {e}")
    finally:
        if 'epd' in locals():
            print("[DISPLAY] wird in den Ruhezustand versetzt.")
            epd.sleep()