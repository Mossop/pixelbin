--UTF-8 encoding and decoding for LuaJIT
--Written by Cosmin Apreutesei. Public Domain.
--From https://github.com/luapower/utf8

local utf8 = {}

local function bottom(val, bits)
  return val % (2 ^ (bits + 1))
end

local function shl(val, count)
  return val * (2 ^ count)
end

-- byte 1     byte 2      byte 3     byte 4
--------------------------------------------
-- 00 - 7F
-- C2 - DF    80 - BF
-- E0         A0 - BF     80 - BF
-- E1 - EC    80 - BF     80 - BF
-- ED         80 - 9F     80 - BF
-- EE - EF    80 - BF     80 - BF
-- F0         90 - BF     80 - BF    80 - BF
-- F1 - F3    80 - BF     80 - BF    80 - BF
-- F4         80 - 8F     80 - BF    80 - BF

function utf8.next(str, i)
  local len = string.len(str)
  if i > len then
    return nil --EOS
  end
  local c1 = string.byte(str, i)
  i = i + 1
  if c1 <= 0x7F then
    return i, c1 --ASCII
  elseif c1 < 0xC2 then
    --invalid
  elseif c1 <= 0xDF then --2-byte
    if i <= len then
      local c2 = string.byte(str, i)
      if c2 >= 0x80 and c2 <= 0xBF then
        return i + 1,
              shl(bottom(c1, 5), 6)
                + bottom(c2, 6)
      end
    end
  elseif c1 <= 0xEF then --3-byte
    if i <= len + 1 then
      local c2, c3 = string.byte(str, i), string.byte(str, i+1)
      if not (
           c2 < 0x80 or c2 > 0xBF
        or c3 < 0x80 or c3 > 0xBF
        or (c1 == 0xE0 and c2 < 0xA0)
        or (c1 == 0xED and c2 > 0x9F)
      ) then
        return i + 2,
              shl(bottom(c1, 4), 12)
            + shl(bottom(c2, 6), 6)
                + bottom(c3, 6)
      end
    end
  elseif c1 <= 0xF4 then --4-byte
    if i <= len + 2 then
      local c2, c3, c4 = string.byte(str, i), string.byte(str, i+1), string.byte(str, i+2)
      if not (
           c2 < 0x80 or c2 > 0xBF
        or c3 < 0x80 or c3 > 0xBF
        or c3 < 0x80 or c3 > 0xBF
        or c4 < 0x80 or c4 > 0xBF
        or (c1 == 0xF0 and c2 < 0x90)
        or (c1 == 0xF4 and c2 > 0x8F)
      ) then
        return i + 3,
             shl(bottom(c1, 3), 18)
           + shl(bottom(c2, 6), 12)
           + shl(bottom(c3, 6), 6)
               + bottom(c4, 6)
      end
    end
  end
  return i, nil, c1 --invalid
end

return utf8
