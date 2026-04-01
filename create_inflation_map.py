import folium

# Crear mapa centrado en Argentina - zoom más alto y ajustado
m = folium.Map(
    location=[-37.5, -63.0],
    zoom_start=5,
    tiles="CartoDB positron",
    max_bounds=True,
    min_zoom=5,
    max_zoom=8
)

# Establecer bounds para limitar a Argentina
# Noroeste: Jujuy aprox -23.5, -66
# Sureste: Tierra del Fuego aprox -55, -52
sw_corner = [-56, -74]
ne_corner = [-21, -52]
m.fit_bounds([sw_corner, ne_corner])

# Regiones
regions = {
    "NOA": {
        "center": [-24.5, -65.5],
        "color": "#FF6B6B",
        "inflation": 3.1,
        "provinces": ["Jujuy", "Salta", "Catamarca", "La Rioja"]
    },
    "NEA": {
        "center": [-27.5, -56.0],
        "color": "#FF433D",
        "inflation": 3.5,
        "provinces": ["Formosa", "Misiones", "Corrientes"]
    },
    "Cuyo": {
        "center": [-31.0, -68.5],
        "color": "#FFD700",
        "inflation": 2.9,
        "provinces": ["San Juan", "Mendoza", "San Luis"]
    },
    "Pampeana": {
        "center": [-29.5, -62.5],
        "color": "#FFA028",
        "inflation": 2.8,
        "provinces": ["Córdoba", "Santa Fe", "S.E."]
    },
    "GBA": {
        "center": [-34.5, -58.5],
        "color": "#FF433D",
        "inflation": 3.2,
        "provinces": ["CABA", "Buenos Aires"]
    },
    "Patagonia": {
        "center": [-42.0, -70.0],
        "color": "#4AF6C3",
        "inflation": 2.5,
        "provinces": ["Neuquén", "Río Negro", "Chubut"]
    }
}

# Agregar marcadores
for region, data in regions.items():
    popup_html = f"""<div style="font-family: monospace; padding: 10px;"><strong style="color: {data['color']};">{region}</strong><br><span style="font-size: 11px;">Inflación: <strong>{data['inflation']}%</strong></span></div>"""
    
    folium.CircleMarker(
        location=data["center"],
        radius=40,
        popup=folium.Popup(popup_html, max_width=250),
        tooltip=f"{region}: {data['inflation']}%",
        color=data["color"],
        fill=True,
        fillColor=data["color"],
        fillOpacity=0.6,
        weight=3,
    ).add_to(m)
    
    folium.Marker(
        location=data["center"],
        icon=folium.DivIcon(html=f"""<div style="font-size: 12px; font-weight: bold; color: white; text-shadow: 0 0 3px black; text-align: center;">{region}<br><span style="font-size: 10px;">{data['inflation']}%</span></div>""")
    ).add_to(m)

m.save("public/inflation_map.html")
print("Mapa acotado a Argentina generado")
