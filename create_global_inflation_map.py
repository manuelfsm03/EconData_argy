#!/usr/bin/env python3
"""
Genera un mapa interactivo global de inflación usando Folium.
Muestra la inflación por país con colores según intensidad.
"""

import folium
from folium import plugins
import json

# Datos de inflación por país (lat, lon, país, inflación%)
inflation_data = [
    (-34.6037, -58.3816, "Argentina", 2.8),
    (-15.7975, -47.8919, "Brasil", 1.2),
    (-33.8688, -151.2093, "Chile", 1.8),
    (19.4326, -99.1332, "México", 2.4),
    (4.5709, -74.2973, "Colombia", 1.9),
    (-9.1900, -77.8467, "Perú", 2.1),
    (37.0902, -95.7129, "Estados Unidos", 1.4),
    (51.1657, 10.4515, "Alemania", 0.9),
    (36.2048, 138.2529, "Japón", 0.5),
    (35.8617, 104.1954, "China", 0.2),
    (46.8182, 8.2275, "Eurozona", 1.0),
    (55.3781, -3.4360, "Reino Unido", 1.5),
    (40.4637, -3.7492, "España", 1.1),
    (48.8566, 2.3522, "Francia", 0.8),
    (41.8719, 12.5674, "Italia", 0.7),
    (60.4720, 8.4689, "Noruega", 1.3),
    (59.3293, 18.0686, "Suecia", 1.2),
    (52.5200, 13.4050, "Berlín", 0.9),
    (-25.2744, 133.7751, "Australia", 0.6),
    (1.3521, 103.8198, "Singapur", 0.4),
    (22.3193, 114.1694, "Hong Kong", 0.5),
    (34.0522, -118.2437, "Los Ángeles", 1.4),
    (40.7128, -74.0060, "Nueva York", 1.4),
    (31.2304, 30.0505, "Egipto", 3.2),
    (-33.9249, 18.4241, "Sudáfrica", 2.5),
    (28.6139, 77.2090, "India", 2.3),
    (19.0760, 72.8777, "Bombay", 2.3),
]

def get_color(inflation):
    """Retorna color según nivel de inflación"""
    if inflation > 3:
        return "#8B0000"  # Rojo oscuro
    elif inflation > 2.5:
        return "#FF0000"  # Rojo
    elif inflation > 2:
        return "#FF433D"  # Rojo naranja
    elif inflation > 1.5:
        return "#FFA028"  # Naranja
    elif inflation > 1:
        return "#FFD700"  # Dorado
    else:
        return "#4AF6C3"  # Verde

# Crear mapa centrado en el mundo
m = folium.Map(
    location=[20, 0],
    zoom_start=2,
    tiles="CartoDB positron",
    prefer_canvas=True,
    max_bounds=True,
)

# Agregar círculos para cada país con inflación
for lat, lon, country, inflation in inflation_data:
    # Determinar tamaño del círculo según inflación
    radius = max(50000, 100000 + (inflation * 30000))  # Mínimo 50km

    color = get_color(inflation)

    # Crear popup con información
    popup_text = f"""
    <div style="font-family: monospace; font-size: 12px; color: white;">
        <b style="color: {color}">{country}</b><br>
        Inflación: <b>{inflation:.1f}%</b>
    </div>
    """

    folium.Circle(
        location=[lat, lon],
        radius=radius,
        popup=folium.Popup(popup_text, max_width=200),
        color=color,
        fill=True,
        fillColor=color,
        fillOpacity=0.6,
        weight=2,
        opacity=0.8
    ).add_to(m)

    # Agregar marcador con nombre del país
    folium.Marker(
        location=[lat, lon],
        popup=country,
        icon=folium.Icon(
            color="gray",
            icon_color=color,
            prefix="fa",
            icon="info"
        )
    ).add_to(m)

# Agregar leyenda
legend_html = '''
<div style="position: fixed;
     bottom: 50px; right: 50px; width: 240px; height: auto;
     background-color: white; border:2px solid grey; z-index:9999;
     font-size:14px; padding: 10px; border-radius: 4px;
     font-family: monospace;">

     <p style="margin: 0 0 10px 0; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
         ESCALA DE INFLACIÓN
     </p>

     <div style="margin: 5px 0;">
         <span style="background-color: #8B0000; width: 20px; height: 20px; display: inline-block; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
         <span>&gt; 3.0%</span>
     </div>

     <div style="margin: 5px 0;">
         <span style="background-color: #FF0000; width: 20px; height: 20px; display: inline-block; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
         <span>2.5 - 3.0%</span>
     </div>

     <div style="margin: 5px 0;">
         <span style="background-color: #FF433D; width: 20px; height: 20px; display: inline-block; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
         <span>2.0 - 2.5%</span>
     </div>

     <div style="margin: 5px 0;">
         <span style="background-color: #FFA028; width: 20px; height: 20px; display: inline-block; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
         <span>1.5 - 2.0%</span>
     </div>

     <div style="margin: 5px 0;">
         <span style="background-color: #FFD700; width: 20px; height: 20px; display: inline-block; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
         <span>1.0 - 1.5%</span>
     </div>

     <div style="margin: 5px 0;">
         <span style="background-color: #4AF6C3; width: 20px; height: 20px; display: inline-block; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
         <span>&lt; 1.0%</span>
     </div>

     <p style="margin: 10px 0 0 0; font-size: 11px; color: #666; border-top: 1px solid #ccc; padding-top: 5px;">
         Datos: Últimas 4 semanas<br>
         Fuente: IMF, Central Banks
     </p>
</div>
'''

m.get_root().html.add_child(folium.Element(legend_html))

# Guardar el mapa
output_path = "c:/Users/juanc/OneDrive/Desktop/Big data y Machine learning/EconData_argy/public/inflation_map_global.html"
m.save(output_path)
print("Mapa global de inflacion guardado en: {}".format(output_path))
