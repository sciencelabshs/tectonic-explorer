import * as THREE from "three";

const SIZE = 0.13;

function pointTexture(label: string | number, labelColor: string, textColor: string) {
  label = label.toString();
  const textureSize = 256;
  const canvas = document.createElement("canvas");
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  // Point
  const shadowBlur = textureSize * 0.2;
  ctx.arc(textureSize / 2, textureSize / 2, textureSize / 2 - shadowBlur, 0, 2 * Math.PI);
  ctx.fillStyle = labelColor;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = shadowBlur;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  // Border
  ctx.lineWidth = textureSize * 0.035;
  ctx.stroke();
  // Label
  ctx.fillStyle = textColor;
  ctx.shadowColor = "rgba(0,0,0,1)";
  ctx.shadowBlur = textureSize * 0.06;
  // Decrease font size for longer labels so they fit relatively small circle container.
  const fontSizeModifier = label.length >= 3 ? 0.65 : (label.length >= 2 ? 0.85 : 1);
  ctx.font = `${fontSizeModifier * textureSize * 0.4}px verdana, arial, helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, textureSize * 0.5, textureSize * 0.52);
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default class PointLabel {
  constructor(label: string, labelColor: string, textColor: string) {
    const texture = pointTexture(label, labelColor, textColor);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(SIZE, SIZE, 1);
    return sprite;
  }
}
