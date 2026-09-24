"""把书法字体与数字字体裁剪为游戏实际用到的字符，生成内联 @font-face（src/fonts.css）。

字体来源（OFL 授权）：
  Ma Shan Zheng     https://fonts.gstatic.com/s/mashanzheng/v18/NaPecZTRCLxvwo41b4gvzkXaRMQ.ttf
  Barlow Condensed  https://fonts.google.com/specimen/Barlow+Condensed （500 / 700）
用法：python3 tools/subset_fonts.py <字体目录>
"""
import base64, glob, io, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fdir = sys.argv[1]
text = ''.join(open(f, encoding='utf8').read() for f in glob.glob(os.path.join(root, 'src', '*')) if not f.endswith('fonts.css'))
cjk = ''.join(sorted(set(c for c in text if ord(c) > 0x2E7F)))
ascii_ = ''.join(chr(i) for i in range(32, 127))

def woff2(path, chars):
    font = TTFont(path)
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']
    sub = subset.Subsetter(opts); sub.populate(text=chars); sub.subset(font)
    buf = io.BytesIO(); font.flavor = 'woff2'; font.save(buf)
    return base64.b64encode(buf.getvalue()).decode()

faces = [
    ('Ma Shan Zheng', 400, 'MaShanZheng.ttf', cjk + ascii_ + '·×★›✦'),
    ('Barlow Condensed', 500, 'Barlow500.ttf', ascii_ + '×·'),
    ('Barlow Condensed', 700, 'Barlow700.ttf', ascii_ + '×·'),
]
css = []
for fam, w, fn, chars in faces:
    b = woff2(os.path.join(fdir, fn), chars)
    css.append("@font-face { font-family: '%s'; font-style: normal; font-weight: %d; font-display: swap; src: url(data:font/woff2;base64,%s) format('woff2'); }" % (fam, w, b))
    print(fam, w, '%.1f KB' % (len(b) * 3 / 4 / 1024))
open(os.path.join(root, 'src', 'fonts.css'), 'w').write('\n'.join(css) + '\n')
print('glyphs', len(cjk))
