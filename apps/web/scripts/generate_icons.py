"""Generate the original Emily PWA icons, standard library only."""
from pathlib import Path
import math
import struct
import zlib

OUTPUT = Path(__file__).resolve().parents[1] / "public" / "icons"
OUTPUT.mkdir(parents=True, exist_ok=True)


def png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def generate(size, maskable=False):
    scale = size * 2 / 192
    n = size * 2
    pixels = bytearray(n * n * 3)
    for y in range(n):
        for x in range(n):
            dx, dy = x / scale - 96, y / scale - 96
            radius = math.hypot(dx, dy)
            color = (16, 21, 18)
            if radius < 61:
                fraction = max(0, 1 - math.hypot(dx + 15, dy + 15) / 90)
                color = (int(24 + fraction * 12), int(39 + fraction * 18), int(29 + fraction * 15))
            if abs(radius - 61) < .7:
                color = (106, 153, 126)
            offset = (y * n + x) * 3
            pixels[offset:offset + 3] = bytes(color)

    def dot(x, y, radius, color):
        cx, cy, r = x * scale, y * scale, radius * scale
        for yy in range(max(0, int(cy - r - 1)), min(n, int(cy + r + 2))):
            for xx in range(max(0, int(cx - r - 1)), min(n, int(cx + r + 2))):
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= r ** 2:
                    i = (yy * n + xx) * 3
                    pixels[i:i + 3] = bytes(color)

    theta = math.radians(-32)
    for i in range(1200):
        t = i / 1200 * math.tau
        ex, ey = 65 * math.cos(t), 46 * math.sin(t)
        dot(96 + ex * math.cos(theta) - ey * math.sin(theta), 96 + ex * math.sin(theta) + ey * math.cos(theta), .45, (72, 105, 84))
    for i in range(220):
        dot(64 + 61 * i / 219, 103, 4.5, (190, 246, 217))
    for p0, p1, p2, p3 in [((125, 103), (133, 72), (82, 54), (67, 94)), ((67, 94), (51, 137), (101, 149), (127, 119))]:
        for i in range(350):
            t = i / 349
            x = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t*t*p2[0] + t**3*p3[0]
            y = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t*t*p2[1] + t**3*p3[1]
            dot(x, y, 4.5, (190, 246, 217))
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            for channel in range(3):
                raw.append(sum(pixels[((y*2+dy)*n+x*2+dx)*3+channel] for dy in (0, 1) for dx in (0, 1)) // 4)
    data = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + png_chunk(b"IDAT", zlib.compress(raw, 9)) + png_chunk(b"IEND", b"")
    path = OUTPUT / f"emily-{'maskable-' if maskable else ''}{size}.png"
    path.write_bytes(data)
    print(f"{path}: {size}x{size}, {len(data)} bytes")


if __name__ == "__main__":
    generate(192)
    generate(512)
    generate(512, maskable=True)
