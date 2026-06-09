def generate_agent_svg(agent):
    # Base dimensions
    width = 100
    height = 100
    
    # Defaults
    body_type = getattr(agent, 'body_type', 'male')
    body_size = getattr(agent, 'body_size', 'normal')
    skin_tone = getattr(agent, 'skin_tone', '#fcd5ce')
    hair_style = getattr(agent, 'hair_style', 'short')
    hair_color = getattr(agent, 'hair_color', '#333333')
    eye_color = getattr(agent, 'eye_color', '#000000')
    facial_hair = getattr(agent, 'facial_hair', 'none')
    glasses = getattr(agent, 'glasses', 'none')
    hat = getattr(agent, 'hat', 'none')
    costume = getattr(agent, 'costume', 'casual')
    held_item = getattr(agent, 'held_item', 'none')
    emoji = getattr(agent, 'emoji', '😐')
    badge_color = getattr(agent, 'badge_color', '#4ade80')

    # Body Size Adjustments
    if body_size == "slim":
        torso_width = 30
        torso_x = 35
    elif body_size == "thick":
        torso_width = 50
        torso_x = 25
    else: # normal
        torso_width = 40
        torso_x = 30

    # SVG Parts
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">')
    
    # 1. Shadow
    parts.append('<ellipse cx="50" cy="95" rx="20" ry="5" fill="rgba(0,0,0,0.2)"/>')
    
    # 2. Body / Legs
    if costume == "suit":
        costume_color = "#1e293b"
        pant_color = "#0f172a"
    elif costume == "developer":
        costume_color = "#38bdf8"
        pant_color = "#334155"
    elif costume == "doctor":
        costume_color = "#ffffff"
        pant_color = "#e2e8f0"
    else: # casual
        costume_color = "#ef4444"
        pant_color = "#3b82f6"
        
    if body_type == "female":
        parts.append(f'<rect x="{torso_x + torso_width*0.15}" y="70" width="{torso_width*0.25}" height="25" fill="{pant_color}" rx="2"/>') # Left leg
        parts.append(f'<rect x="{torso_x + torso_width*0.6}" y="70" width="{torso_width*0.25}" height="25" fill="{pant_color}" rx="2"/>') # Right leg
        parts.append(f'<path d="M 35 45 Q 50 45 65 45 L {torso_x + torso_width + 5} 75 L {torso_x - 5} 75 Z" fill="{costume_color}"/>') # Skirt
        parts.append(f'<rect x="{torso_x - 8}" y="45" width="8" height="23" fill="{costume_color}" rx="3"/>') # Left arm
        parts.append(f'<rect x="{torso_x + torso_width}" y="45" width="8" height="23" fill="{costume_color}" rx="3"/>') # Right arm
        parts.append(f'<circle cx="{torso_x - 4}" cy="68" r="4" fill="{skin_tone}"/>') # Left hand
        parts.append(f'<circle cx="{torso_x + torso_width + 4}" cy="68" r="4" fill="{skin_tone}"/>') # Right hand
    else: # male
        parts.append(f'<rect x="{torso_x + torso_width*0.125}" y="70" width="{torso_width*0.3}" height="25" fill="{pant_color}" rx="2"/>') # Left leg
        parts.append(f'<rect x="{torso_x + torso_width*0.575}" y="70" width="{torso_width*0.3}" height="25" fill="{pant_color}" rx="2"/>') # Right leg
        parts.append(f'<rect x="{torso_x}" y="45" width="{torso_width}" height="30" fill="{costume_color}" rx="5"/>') # Torso
        parts.append(f'<rect x="{torso_x - 10}" y="45" width="10" height="25" fill="{costume_color}" rx="3"/>') # Left arm
        parts.append(f'<rect x="{torso_x + torso_width}" y="45" width="10" height="25" fill="{costume_color}" rx="3"/>') # Right arm
        parts.append(f'<circle cx="{torso_x - 5}" cy="70" r="5" fill="{skin_tone}"/>') # Left hand
        parts.append(f'<circle cx="{torso_x + torso_width + 5}" cy="70" r="5" fill="{skin_tone}"/>') # Right hand
    
    # Badge (on chest)
    parts.append(f'<circle cx="{torso_x + torso_width*0.8}" cy="52" r="3" fill="{badge_color}"/>')

    # 3. Head
    parts.append(f'<rect x="30" y="15" width="40" height="35" fill="{skin_tone}" rx="15"/>') # Head
    
    # 4. Face (Emoji)
    if emoji and emoji != "none":
        # Use emoji directly as text centered on the head
        parts.append(f'<text x="50" y="35" font-size="22" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="central">{emoji}</text>')
    else:
        # Eyes fallback
        parts.append(f'<circle cx="42" cy="30" r="3" fill="{eye_color}"/>')
        parts.append(f'<circle cx="58" cy="30" r="3" fill="{eye_color}"/>')
    
    # 6. Facial Hair
    if facial_hair == "beard":
        parts.append(f'<path d="M 30 35 Q 50 55 70 35 L 70 45 Q 50 60 30 45 Z" fill="{hair_color}"/>')
    elif facial_hair == "mustache":
        parts.append(f'<rect x="42" y="38" width="16" height="4" fill="{hair_color}" rx="2"/>')
        
    # 7. Hair
    if hair_style == "short":
        parts.append(f'<path d="M 30 25 Q 50 5 70 25 L 70 15 Q 50 -5 30 15 Z" fill="{hair_color}"/>')
    elif hair_style == "long":
        parts.append(f'<path d="M 30 25 Q 50 5 70 25 L 75 50 L 65 50 L 65 25 Q 50 15 35 25 L 35 50 L 25 50 Z" fill="{hair_color}"/>')
    elif hair_style == "spiky":
        parts.append(f'<path d="M 30 25 L 35 5 L 45 20 L 50 0 L 55 20 L 65 5 L 70 25 Z" fill="{hair_color}"/>')
    elif hair_style == "bald":
        pass # No hair
        
    # 8. Glasses
    if glasses == "round":
        parts.append('<circle cx="42" cy="30" r="6" fill="none" stroke="black" stroke-width="2"/>')
        parts.append('<circle cx="58" cy="30" r="6" fill="none" stroke="black" stroke-width="2"/>')
        parts.append('<line x1="48" y1="30" x2="52" y2="30" stroke="black" stroke-width="2"/>')
    elif glasses == "sunglasses":
        parts.append('<rect x="36" y="26" width="12" height="8" fill="black" rx="2"/>')
        parts.append('<rect x="52" y="26" width="12" height="8" fill="black" rx="2"/>')
        parts.append('<line x1="48" y1="30" x2="52" y2="30" stroke="black" stroke-width="2"/>')
        
    # 9. Hat
    if hat == "cap":
        parts.append(f'<path d="M 25 20 Q 50 5 75 20 L 85 20 L 85 25 L 25 25 Z" fill="{costume_color}"/>')
    elif hat == "tophat":
        parts.append('<rect x="35" y="0" width="30" height="20" fill="black"/>')
        parts.append('<rect x="25" y="20" width="50" height="5" fill="black"/>')
        
    # 10. Held Item
    if held_item == "laptop":
        parts.append('<rect x="15" y="55" width="20" height="15" fill="#94a3b8" rx="2"/>')
        parts.append('<rect x="17" y="57" width="16" height="11" fill="#0f172a" rx="1"/>')
    elif held_item == "coffee":
        parts.append('<rect x="20" y="55" width="10" height="15" fill="#f8fafc" rx="2"/>')
        parts.append('<rect x="18" y="55" width="14" height="3" fill="#e2e8f0" rx="1"/>')
        
    # 11. Badge
    parts.append(f'<circle cx="60" cy="55" r="4" fill="{badge_color}"/>')
    parts.append('<circle cx="60" cy="55" r="2" fill="white"/>')

    parts.append('</svg>')
    return "".join(parts)
