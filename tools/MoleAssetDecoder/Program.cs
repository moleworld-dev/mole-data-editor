using System.Buffers.Binary;
using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using TextureCompressor.FileFormats.Png;
using TextureCompressor.FileFormats.Pvr;

internal static partial class Program
{
    private static readonly byte[] DatKey = Encoding.ASCII.GetBytes("39653543fa0d66aa");
    internal static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static int Main(string[] args)
    {
        try
        {
            var options = DecodeOptions.Parse(args);
            if (options.ShowHelp)
            {
                PrintHelp();
                return 0;
            }

            Directory.CreateDirectory(options.OutputDirectory);
            var decoder = new MoleAssetDecoder(options);
            decoder.Run();
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("error: " + ex.Message);
            return 1;
        }
    }

    private static void PrintHelp()
    {
        Console.WriteLine("""
MoleAssetDecoder

Usage:
  dotnet run --project tools/MoleAssetDecoder -- --ipa <MoleWorld.ipa> --out <output-dir> [--locale zh-Hans]

Output:
  manifest.json              top-level export summary
  object-catalog.json        property/property_description rows keyed for future rendering
  atlas-frames.json          Cocos plist/asprite frame rectangles mapped to exported textures
  tables/*.json              decoded plist/dat tables
  textures/png/*             source PNG/JPG plus decoded PVR/CCZ previews
  textures/pvr/*             decompressed PVR payloads from *.pvr.ccz
""");
    }
}

internal sealed record DecodeOptions(
    string IpaPath,
    string OutputDirectory,
    string Locale,
    bool ShowHelp)
{
    public static DecodeOptions Parse(string[] args)
    {
        string? ipa = null;
        string output = Path.GetFullPath("exported-assets");
        string locale = "zh-Hans";
        var showHelp = args.Length == 0;

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            string Next()
            {
                if (i + 1 >= args.Length) throw new ArgumentException($"{arg} needs a value");
                return args[++i];
            }

            switch (arg)
            {
                case "-h":
                case "--help":
                    showHelp = true;
                    break;
                case "--ipa":
                    ipa = Next();
                    break;
                case "--out":
                    output = Next();
                    break;
                case "--locale":
                    locale = Next();
                    break;
                default:
                    throw new ArgumentException($"unknown argument: {arg}");
            }
        }

        if (!showHelp && string.IsNullOrWhiteSpace(ipa)) throw new ArgumentException("--ipa is required");
        return new DecodeOptions(
            Path.GetFullPath(ipa ?? ""),
            Path.GetFullPath(output),
            locale,
            showHelp);
    }
}

internal sealed partial class MoleAssetDecoder(DecodeOptions options)
{
    private readonly List<JsonObject> _textures = [];
    private readonly List<JsonObject> _tables = [];
    private readonly List<JsonObject> _atlasFrames = [];
    private readonly List<JsonObject> _objects = [];
    private readonly Dictionary<string, JsonNode?> _decodedTablesByBaseName = new(StringComparer.OrdinalIgnoreCase);

    private string TablesDir => Path.Combine(options.OutputDirectory, "tables");
    private string TexturePngDir => Path.Combine(options.OutputDirectory, "textures", "png");
    private string TexturePvrDir => Path.Combine(options.OutputDirectory, "textures", "pvr");

    public void Run()
    {
        if (!File.Exists(options.IpaPath)) throw new FileNotFoundException("IPA not found", options.IpaPath);
        Directory.CreateDirectory(TablesDir);
        Directory.CreateDirectory(TexturePngDir);
        Directory.CreateDirectory(TexturePvrDir);

        using var ipa = ZipFile.OpenRead(options.IpaPath);
        var entries = ipa.Entries
            .Where(e => !string.IsNullOrEmpty(e.Name) && IsAppPayload(e.FullName))
            .OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var entry in entries)
        {
            var ext = LowerName(entry.Name);
            if (ext.EndsWith(".png", StringComparison.Ordinal) || ext.EndsWith(".jpg", StringComparison.Ordinal))
            {
                CopyImage(entry);
            }
            else if (ext.EndsWith(".pvr.ccz", StringComparison.Ordinal) || ext.EndsWith(".ccz", StringComparison.Ordinal) || ext.EndsWith(".pvr", StringComparison.Ordinal))
            {
                ExportTexture(entry);
            }
            else if (ext.EndsWith(".dat", StringComparison.Ordinal) || ext.EndsWith(".plist", StringComparison.Ordinal))
            {
                ExportTable(entry);
            }
        }

        BuildObjectCatalog();
        BuildAtlasFrames();
        WriteJson(Path.Combine(options.OutputDirectory, "object-catalog.json"), _objects);
        WriteJson(Path.Combine(options.OutputDirectory, "atlas-frames.json"), _atlasFrames);

        var manifest = new JsonObject
        {
            ["format"] = "moleworld-assets",
            ["version"] = 1,
            ["exported_at"] = DateTimeOffset.Now.ToString("O", CultureInfo.InvariantCulture),
            ["source_ipa"] = options.IpaPath,
            ["locale"] = options.Locale,
            ["counts"] = new JsonObject
            {
                ["ipa_entries"] = entries.Count,
                ["tables"] = _tables.Count,
                ["textures"] = _textures.Count,
                ["atlas_frames"] = _atlasFrames.Count,
                ["objects"] = _objects.Count,
            },
            ["tables"] = ToArray(_tables),
            ["textures"] = ToArray(_textures),
            ["outputs"] = new JsonObject
            {
                ["object_catalog"] = "object-catalog.json",
                ["atlas_frames"] = "atlas-frames.json",
            },
        };
        WriteJson(Path.Combine(options.OutputDirectory, "manifest.json"), manifest);

        Console.WriteLine($"exported {_tables.Count} tables, {_textures.Count} textures, {_atlasFrames.Count} atlas frames, {_objects.Count} object rows");
        Console.WriteLine(options.OutputDirectory);
    }

    private static bool IsAppPayload(string path) =>
        path.StartsWith("Payload/", StringComparison.OrdinalIgnoreCase) &&
        path.Contains(".app/", StringComparison.OrdinalIgnoreCase);

    private void CopyImage(ZipArchiveEntry entry)
    {
        var raw = ReadAllBytes(entry);
        var relative = TextureRelativePath(entry.FullName);
        var output = Path.Combine(TexturePngDir, relative);
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        var isPng = LowerName(entry.Name).EndsWith(".png", StringComparison.Ordinal);
        var cgbiConverted = false;
        string? cgbiInfo = null;
        if (isPng && CgbiPngConverter.TryConvert(raw, out var standardPng, out cgbiInfo))
        {
            File.WriteAllBytes(output, standardPng);
            cgbiConverted = true;
        }
        else
        {
            File.WriteAllBytes(output, raw);
        }

        var size = TryReadPngSize(rawPath: output);
        _textures.Add(new JsonObject
        {
            ["source"] = entry.FullName,
            ["kind"] = LowerName(entry.Name).EndsWith(".jpg", StringComparison.Ordinal) ? "jpg" : "png",
            ["png"] = RelativeOutput(output),
            ["bytes"] = raw.Length,
            ["width"] = size?.Width,
            ["height"] = size?.Height,
            ["cgbi_converted"] = cgbiConverted,
            ["cgbi_color"] = cgbiConverted ? cgbiInfo : null,
        });
    }

    private void ExportTexture(ZipArchiveEntry entry)
    {
        var raw = ReadAllBytes(entry);
        var sourceName = LowerName(entry.Name);
        var record = new JsonObject
        {
            ["source"] = entry.FullName,
            ["bytes"] = raw.Length,
        };

        try
        {
            var pvrBytes = sourceName.EndsWith(".ccz", StringComparison.Ordinal) ? Ccz.Unpack(raw) : raw;
            var pvrRelative = TextureRelativePath(RemoveKnownTextureExtension(entry.FullName) + ".pvr");
            var pvrPath = Path.Combine(TexturePvrDir, pvrRelative);
            Directory.CreateDirectory(Path.GetDirectoryName(pvrPath)!);
            File.WriteAllBytes(pvrPath, pvrBytes);
            record["kind"] = sourceName.EndsWith(".ccz", StringComparison.Ordinal) ? "pvr.ccz" : "pvr";
            record["pvr"] = RelativeOutput(pvrPath);

            var bitmap = PvrCodec.Decode(pvrBytes);
            var pngRelative = TextureRelativePath(RemoveKnownTextureExtension(entry.FullName) + ".png");
            var pngPath = Path.Combine(TexturePngDir, pngRelative);
            Directory.CreateDirectory(Path.GetDirectoryName(pngPath)!);
            PngCodec.Encode(bitmap, pngPath);
            record["png"] = RelativeOutput(pngPath);
            record["width"] = bitmap.Width;
            record["height"] = bitmap.Height;
            record["decoded"] = true;
        }
        catch (Exception ex)
        {
            record["kind"] = sourceName.EndsWith(".ccz", StringComparison.Ordinal) ? "pvr.ccz" : "pvr";
            record["decoded"] = false;
            record["error"] = ex.Message;
        }

        _textures.Add(record);
    }

    private void ExportTable(ZipArchiveEntry entry)
    {
        var raw = ReadAllBytes(entry);
        var ext = LowerName(entry.Name);
        JsonNode? decoded;
        var encrypted = false;
        byte[] payload;

        try
        {
            if (ext.EndsWith(".dat", StringComparison.Ordinal))
            {
                var dat = DatDecoder.Decode(raw);
                encrypted = dat.Encrypted;
                payload = dat.PlistBytes;
                decoded = PlistDecoder.Decode(payload);
            }
            else
            {
                payload = raw;
                decoded = PlistDecoder.Decode(payload);
            }
        }
        catch (Exception ex)
        {
            _tables.Add(new JsonObject
            {
                ["source"] = entry.FullName,
                ["kind"] = ext.EndsWith(".dat", StringComparison.Ordinal) ? "unsupported-dat" : "unsupported-plist",
                ["bytes"] = raw.Length,
                ["decoded"] = false,
                ["error"] = ex.Message,
            });
            return;
        }

        var resolved = KeyedArchiveResolver.Resolve(decoded);
        var baseName = TableKey(entry.FullName);
        var outPath = Path.Combine(TablesDir, baseName + ".json");
        WriteJson(outPath, resolved.Tree);

        _decodedTablesByBaseName[baseName] = resolved.Tree;
        var record = new JsonObject
        {
            ["source"] = entry.FullName,
            ["output"] = RelativeOutput(outPath),
            ["kind"] = ext.EndsWith(".dat", StringComparison.Ordinal) ? "dat-plist" : "plist",
            ["encrypted"] = encrypted,
            ["bytes"] = raw.Length,
            ["decoded_bytes"] = payload.Length,
        };
        if (resolved.ClassCounts.Count > 0)
        {
            var classCounts = new JsonObject();
            foreach (var (key, value) in resolved.ClassCounts.OrderBy(k => k.Key, StringComparer.Ordinal)) classCounts[key] = value;
            record["class_counts"] = classCounts;
        }
        _tables.Add(record);
    }

    private void BuildObjectCatalog()
    {
        foreach (var (name, node) in _decodedTablesByBaseName)
        {
            if (!LooksLikeObjectTable(name, node)) continue;
            foreach (var (id, row) in EnumerateRows(node))
            {
                var obj = new JsonObject
                {
                    ["id"] = id,
                    ["source_table"] = name,
                    ["name"] = FirstString(row, "name", "Name", "title", "titleName", "displayName"),
                    ["type"] = FirstString(row, "type", "classType", "category", "kind"),
                    ["raw"] = row?.DeepClone(),
                };

                var texture = FindLikelyTexture(id);
                if (texture is not null) obj["texture"] = texture;
                _objects.Add(obj);
            }
        }
    }

    private void BuildAtlasFrames()
    {
        foreach (var (name, node) in _decodedTablesByBaseName)
        {
            if (node is not JsonObject atlasObj) continue;
            var frames = atlasObj["frames"] as JsonObject;
            if (frames is null) continue;
            var textureName = FirstString(atlasObj, "textureFileName", "metadata.textureFileName") ?? name;
            foreach (var (frameName, value) in frames)
            {
                if (value is not JsonObject frameObj) continue;
                var rect = RectFromNode(frameObj["frame"]);
                var sourceSize = SizeFromNode(frameObj["sourceSize"]);
                var offset = PointFromNode(frameObj["offset"]);
                _atlasFrames.Add(new JsonObject
                {
                    ["atlas"] = name,
                    ["frame_name"] = frameName,
                    ["texture"] = textureName,
                    ["rect"] = rect is null ? null : new JsonObject { ["x"] = rect.Value.X, ["y"] = rect.Value.Y, ["w"] = rect.Value.W, ["h"] = rect.Value.H },
                    ["source_size"] = sourceSize is null ? null : new JsonObject { ["w"] = sourceSize.Value.W, ["h"] = sourceSize.Value.H },
                    ["offset"] = offset is null ? null : new JsonObject { ["x"] = offset.Value.X, ["y"] = offset.Value.Y },
                    ["rotated"] = BoolValue(frameObj["rotated"]) || BoolValue(frameObj["textureRotated"]),
                    ["raw"] = frameObj.DeepClone(),
                });
            }
        }
    }

    private static bool LooksLikeObjectTable(string name, JsonNode? node)
    {
        return name.Equals("property", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("propertyHV", StringComparison.OrdinalIgnoreCase) ||
            name.EndsWith("_property_description", StringComparison.OrdinalIgnoreCase) ||
            name.EndsWith("_property_descriptionHV", StringComparison.OrdinalIgnoreCase);
    }

    private static IEnumerable<(string Id, JsonNode? Row)> EnumerateRows(JsonNode? node)
    {
        if (node is JsonArray array)
        {
            for (var i = 0; i < array.Count; i++)
            {
                var row = array[i];
                var id = FirstString(row, "id", "objectId", "itemId", "ID") ?? i.ToString(CultureInfo.InvariantCulture);
                yield return (id, row);
            }
        }
        else if (node is JsonObject obj)
        {
            foreach (var (key, value) in obj)
            {
                if (value is JsonObject or JsonArray) yield return (key, value);
            }
        }
    }

    private JsonObject? FindLikelyTexture(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        var pattern = new Regex($@"(^|[^0-9]){Regex.Escape(id)}([^0-9]|$)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        var hit = _textures.FirstOrDefault(t =>
            pattern.IsMatch(Path.GetFileName(StringValue(t["source"]) ?? "")) ||
            pattern.IsMatch(Path.GetFileName(StringValue(t["png"]) ?? "")));
        return hit is null
            ? null
            : new JsonObject
            {
                ["source"] = hit["source"]?.DeepClone(),
                ["png"] = hit["png"]?.DeepClone(),
                ["width"] = hit["width"]?.DeepClone(),
                ["height"] = hit["height"]?.DeepClone(),
            };
    }

    private static JsonArray ToArray(IEnumerable<JsonObject> items)
    {
        var array = new JsonArray();
        foreach (var item in items) array.Add(item.DeepClone());
        return array;
    }

    private static string LowerName(string name) => name.ToLowerInvariant();

    private static string RemoveKnownTextureExtension(string path)
    {
        foreach (var suffix in new[] { ".pvr.ccz", ".ccz", ".pvr" })
        {
            if (path.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) return path[..^suffix.Length];
        }
        return Path.ChangeExtension(path, null);
    }

    private static string TextureRelativePath(string sourcePath)
    {
        var appIndex = sourcePath.IndexOf(".app/", StringComparison.OrdinalIgnoreCase);
        var rel = appIndex >= 0 ? sourcePath[(appIndex + 5)..] : sourcePath;
        return SanitizeRelativePath(rel);
    }

    private static string TableKey(string sourcePath)
    {
        var rel = TextureRelativePath(sourcePath);
        rel = Regex.Replace(rel, @"\.(dat|plist)$", "", RegexOptions.IgnoreCase);
        return SanitizeRelativePath(rel).Replace(Path.DirectorySeparatorChar, '_').Replace(Path.AltDirectorySeparatorChar, '_');
    }

    private static string SanitizeRelativePath(string rel)
    {
        rel = rel.Replace('\\', '/').TrimStart('/');
        var invalid = Path.GetInvalidFileNameChars();
        var parts = rel.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => new string(part.Select(ch => invalid.Contains(ch) ? '_' : ch).ToArray()));
        return Path.Combine(parts.ToArray());
    }

    private string RelativeOutput(string path) => Path.GetRelativePath(options.OutputDirectory, path).Replace('\\', '/');

    private static byte[] ReadAllBytes(ZipArchiveEntry entry)
    {
        using var stream = entry.Open();
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }

    private static (int Width, int Height)? TryReadPngSize(string rawPath)
    {
        Span<byte> header = stackalloc byte[8];
        using var stream = File.OpenRead(rawPath);
        if (stream.Read(header) < header.Length) return null;
        if (header[0] != 0x89 || header[1] != 0x50 || header[2] != 0x4e || header[3] != 0x47 ||
            header[4] != 0x0d || header[5] != 0x0a || header[6] != 0x1a || header[7] != 0x0a)
        {
            return null;
        }

        Span<byte> chunkHead = stackalloc byte[8];
        Span<byte> ihdr = stackalloc byte[8];
        while (stream.Position + 8 <= stream.Length && stream.Read(chunkHead) == 8)
        {
            var length = BinaryPrimitives.ReadInt32BigEndian(chunkHead[..4]);
            var type = Encoding.ASCII.GetString(chunkHead[4..8]);
            if (length < 0 || stream.Position + length + 4 > stream.Length) return null;
            if (type == "IHDR")
            {
                if (length < 8 || stream.Read(ihdr) < 8) return null;
                return (
                    BinaryPrimitives.ReadInt32BigEndian(ihdr[..4]),
                    BinaryPrimitives.ReadInt32BigEndian(ihdr[4..8]));
            }

            stream.Position += length + 4L;
        }

        return null;
    }

    private static void WriteJson(string path, object? value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(value, Program.JsonOptions) + Environment.NewLine, Encoding.UTF8);
    }

    private static string? FirstString(JsonNode? node, params string[] keys)
    {
        foreach (var key in keys)
        {
            JsonNode? value = null;
            if (key.Contains('.', StringComparison.Ordinal))
            {
                value = key.Split('.').Aggregate(node, (current, part) => current?[part]);
            }
            else
            {
                value = node?[key];
            }
            var text = StringValue(value);
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }
        return null;
    }

    private static string? StringValue(JsonNode? node) => node?.GetValueKind() switch
    {
        JsonValueKind.String => node.GetValue<string>(),
        JsonValueKind.Number => node.ToJsonString(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        _ => null,
    };

    private static double DoubleValue(JsonNode? node, double fallback = 0)
    {
        if (node is null) return fallback;
        if (node.GetValueKind() == JsonValueKind.Number && node.AsValue().TryGetValue<double>(out var d)) return d;
        return double.TryParse(StringValue(node), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : fallback;
    }

    private static bool BoolValue(JsonNode? node)
    {
        if (node is null) return false;
        if (node.GetValueKind() == JsonValueKind.True) return true;
        if (node.GetValueKind() == JsonValueKind.False) return false;
        var text = StringValue(node);
        return text is "1" || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase) || string.Equals(text, "YES", StringComparison.OrdinalIgnoreCase);
    }

    private static (double X, double Y, double W, double H)? RectFromNode(JsonNode? node)
    {
        var nums = NumbersFromNode(node);
        return nums.Length >= 4 ? (nums[0], nums[1], nums[2], nums[3]) : null;
    }

    private static (double W, double H)? SizeFromNode(JsonNode? node)
    {
        var nums = NumbersFromNode(node);
        return nums.Length >= 2 ? (nums[0], nums[1]) : null;
    }

    private static (double X, double Y)? PointFromNode(JsonNode? node)
    {
        var nums = NumbersFromNode(node);
        return nums.Length >= 2 ? (nums[0], nums[1]) : null;
    }

    private static double[] NumbersFromNode(JsonNode? node)
    {
        if (node is JsonArray arr) return arr.Select(item => DoubleValue(item)).ToArray();
        var text = StringValue(node);
        if (text is null) return [];
        return NumberRegex().Matches(text)
            .Select(m => double.Parse(m.Value, CultureInfo.InvariantCulture))
            .ToArray();
    }

    [GeneratedRegex(@"-?\d+(?:\.\d+)?")]
    private static partial Regex NumberRegex();

}

internal static class DatDecoder
{
    public static (byte[] PlistBytes, bool Encrypted) Decode(byte[] raw)
    {
        if (PlistDecoder.HasBinaryHeader(raw) || PlistDecoder.LooksLikeXmlPlist(raw)) return (raw, false);
        if (raw.Length < 16) throw new InvalidDataException("DAT is neither plist nor AES-encrypted content");

        using var aes = Aes.Create();
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.PKCS7;
        aes.Key = ProgramReflection.DatKey;

        for (var length = raw.Length / 16 * 16; length >= 16; length -= 16)
        {
            try
            {
                using var decryptor = aes.CreateDecryptor();
                var decrypted = decryptor.TransformFinalBlock(raw, 0, length);
                if (PlistDecoder.HasBinaryHeader(decrypted) || PlistDecoder.LooksLikeXmlPlist(decrypted)) return (decrypted, true);
            }
            catch (CryptographicException)
            {
                // Some DAT files have plaintext tails; retry a shorter aligned prefix.
            }
        }

        throw new InvalidDataException("DAT decrypt failed");
    }

    private static class ProgramReflection
    {
        public static readonly byte[] DatKey = Encoding.ASCII.GetBytes("39653543fa0d66aa");
    }
}

internal static class Ccz
{
    public static byte[] Unpack(byte[] raw)
    {
        if (raw.Length < 16 || raw[0] != (byte)'C' || raw[1] != (byte)'C' || raw[2] != (byte)'Z' || raw[3] != (byte)'!')
        {
            throw new InvalidDataException("not a CCZ file");
        }

        var compression = BinaryPrimitives.ReadUInt16BigEndian(raw.AsSpan(4, 2));
        var unpackedLength = BinaryPrimitives.ReadUInt32BigEndian(raw.AsSpan(12, 4));
        if (compression != 0) throw new NotSupportedException($"unsupported CCZ compression type {compression}");

        using var source = new MemoryStream(raw, 16, raw.Length - 16);
        using var zlib = new ZLibStream(source, CompressionMode.Decompress);
        using var output = new MemoryStream(unpackedLength > 0 && unpackedLength < int.MaxValue ? (int)unpackedLength : 0);
        zlib.CopyTo(output);
        return output.ToArray();
    }
}

internal static class CgbiPngConverter
{
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    public static bool TryConvert(byte[] raw, out byte[] standardPng, out string? colorInfo)
    {
        standardPng = [];
        colorInfo = null;
        if (raw.Length < 33 || !raw.AsSpan(0, 8).SequenceEqual(PngSignature)) return false;

        var hasCgbi = false;
        var width = 0;
        var height = 0;
        var bitDepth = 0;
        var colorType = 0;
        var compression = 0;
        var filter = 0;
        var interlace = 0;
        using var idat = new MemoryStream();

        var offset = 8;
        while (offset + 12 <= raw.Length)
        {
            var length = BinaryPrimitives.ReadInt32BigEndian(raw.AsSpan(offset, 4));
            var type = Encoding.ASCII.GetString(raw, offset + 4, 4);
            offset += 8;
            if (length < 0 || offset + length + 4 > raw.Length) return false;
            var data = raw.AsSpan(offset, length);

            if (type == "CgBI")
            {
                hasCgbi = true;
            }
            else if (type == "IHDR")
            {
                if (length < 13) return false;
                width = BinaryPrimitives.ReadInt32BigEndian(data[..4]);
                height = BinaryPrimitives.ReadInt32BigEndian(data[4..8]);
                bitDepth = data[8];
                colorType = data[9];
                compression = data[10];
                filter = data[11];
                interlace = data[12];
            }
            else if (type == "IDAT")
            {
                idat.Write(data);
            }

            offset += length + 4;
            if (type == "IEND") break;
        }

        if (!hasCgbi) return false;
        if (width <= 0 || height <= 0) throw new InvalidDataException("CgBI PNG has no valid IHDR");
        if (bitDepth != 8 || colorType != 6 || compression != 0 || filter != 0 || interlace is not (0 or 1))
        {
            throw new NotSupportedException($"unsupported CgBI PNG format: bitDepth={bitDepth}, colorType={colorType}, interlace={interlace}");
        }

        var compressed = idat.ToArray();
        var inflated = InflateCgbiIdat(compressed);
        var rgba = interlace == 0
            ? DecodeFilteredBgra(inflated, width, height)
            : DecodeAdam7FilteredBgra(inflated, width, height);
        standardPng = EncodeStandardRgbaPng(width, height, rgba);
        colorInfo = "bgra-premultiplied-to-rgba";
        return true;
    }

    private static byte[] InflateCgbiIdat(byte[] compressed)
    {
        try
        {
            using var input = new MemoryStream(compressed);
            using var deflate = new DeflateStream(input, CompressionMode.Decompress);
            using var output = new MemoryStream();
            deflate.CopyTo(output);
            return output.ToArray();
        }
        catch (InvalidDataException)
        {
            using var input = new MemoryStream(compressed);
            using var zlib = new ZLibStream(input, CompressionMode.Decompress);
            using var output = new MemoryStream();
            zlib.CopyTo(output);
            return output.ToArray();
        }
    }

    private static byte[] DecodeFilteredBgra(byte[] filtered, int width, int height)
    {
        var stride = checked(width * 4);
        var expected = checked((stride + 1) * height);
        if (filtered.Length < expected) throw new InvalidDataException($"CgBI scanline data is too short: {filtered.Length} < {expected}");

        var current = new byte[stride];
        var previous = new byte[stride];
        var rgba = new byte[checked(stride * height)];
        var src = 0;
        var dst = 0;

        for (var y = 0; y < height; y++)
        {
            var filterType = filtered[src++];
            Array.Copy(filtered, src, current, 0, stride);
            src += stride;
            Unfilter(current, previous, filterType, 4);

            for (var x = 0; x < stride; x += 4)
            {
                var b = current[x];
                var g = current[x + 1];
                var r = current[x + 2];
                var a = current[x + 3];
                if (a is > 0 and < 255)
                {
                    r = Unpremultiply(r, a);
                    g = Unpremultiply(g, a);
                    b = Unpremultiply(b, a);
                }

                rgba[dst++] = r;
                rgba[dst++] = g;
                rgba[dst++] = b;
                rgba[dst++] = a;
            }

            (current, previous) = (previous, current);
        }

        return rgba;
    }

    private static byte[] DecodeAdam7FilteredBgra(byte[] filtered, int width, int height)
    {
        ReadOnlySpan<(int X, int Y, int Dx, int Dy)> passes =
        [
            (0, 0, 8, 8),
            (4, 0, 8, 8),
            (0, 4, 4, 8),
            (2, 0, 4, 4),
            (0, 2, 2, 4),
            (1, 0, 2, 2),
            (0, 1, 1, 2),
        ];

        var rgba = new byte[checked(width * height * 4)];
        var src = 0;
        foreach (var pass in passes)
        {
            var passWidth = PassSize(width, pass.X, pass.Dx);
            var passHeight = PassSize(height, pass.Y, pass.Dy);
            if (passWidth == 0 || passHeight == 0) continue;

            var stride = checked(passWidth * 4);
            var current = new byte[stride];
            var previous = new byte[stride];
            for (var row = 0; row < passHeight; row++)
            {
                if (src >= filtered.Length) throw new InvalidDataException("CgBI Adam7 scanline data is too short");
                var filterType = filtered[src++];
                if (src + stride > filtered.Length) throw new InvalidDataException("CgBI Adam7 scanline data is too short");
                Array.Copy(filtered, src, current, 0, stride);
                src += stride;
                Unfilter(current, previous, filterType, 4);

                var y = pass.Y + row * pass.Dy;
                for (var col = 0; col < passWidth; col++)
                {
                    var x = pass.X + col * pass.Dx;
                    var srcPixel = col * 4;
                    var dstPixel = (y * width + x) * 4;
                    var b = current[srcPixel];
                    var g = current[srcPixel + 1];
                    var r = current[srcPixel + 2];
                    var a = current[srcPixel + 3];
                    if (a is > 0 and < 255)
                    {
                        r = Unpremultiply(r, a);
                        g = Unpremultiply(g, a);
                        b = Unpremultiply(b, a);
                    }

                    rgba[dstPixel] = r;
                    rgba[dstPixel + 1] = g;
                    rgba[dstPixel + 2] = b;
                    rgba[dstPixel + 3] = a;
                }

                (current, previous) = (previous, current);
            }
        }

        return rgba;
    }

    private static int PassSize(int size, int start, int step) =>
        size <= start ? 0 : (size - start + step - 1) / step;

    private static void Unfilter(byte[] row, byte[] previous, int filterType, int bytesPerPixel)
    {
        switch (filterType)
        {
            case 0:
                return;
            case 1:
                for (var i = 0; i < row.Length; i++)
                {
                    var left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
                    row[i] = unchecked((byte)(row[i] + left));
                }
                return;
            case 2:
                for (var i = 0; i < row.Length; i++) row[i] = unchecked((byte)(row[i] + previous[i]));
                return;
            case 3:
                for (var i = 0; i < row.Length; i++)
                {
                    var left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
                    var up = previous[i];
                    row[i] = unchecked((byte)(row[i] + ((left + up) >> 1)));
                }
                return;
            case 4:
                for (var i = 0; i < row.Length; i++)
                {
                    var left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
                    var up = previous[i];
                    var upperLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
                    row[i] = unchecked((byte)(row[i] + Paeth(left, up, upperLeft)));
                }
                return;
            default:
                throw new InvalidDataException($"unsupported PNG filter type {filterType}");
        }
    }

    private static byte Unpremultiply(byte value, byte alpha) =>
        (byte)Math.Min(255, (value * 255 + alpha / 2) / alpha);

    private static int Paeth(int a, int b, int c)
    {
        var p = a + b - c;
        var pa = Math.Abs(p - a);
        var pb = Math.Abs(p - b);
        var pc = Math.Abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        return pb <= pc ? b : c;
    }

    private static byte[] EncodeStandardRgbaPng(int width, int height, byte[] rgba)
    {
        var stride = checked(width * 4);
        using var scanlines = new MemoryStream(checked((stride + 1) * height));
        for (var y = 0; y < height; y++)
        {
            scanlines.WriteByte(0);
            scanlines.Write(rgba, y * stride, stride);
        }

        byte[] idatBytes;
        using (var compressed = new MemoryStream())
        {
            using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
            {
                scanlines.TryGetBuffer(out var segment);
                zlib.Write(segment);
            }
            idatBytes = compressed.ToArray();
        }

        using var png = new MemoryStream();
        png.Write(PngSignature);

        Span<byte> ihdr = stackalloc byte[13];
        BinaryPrimitives.WriteInt32BigEndian(ihdr[..4], width);
        BinaryPrimitives.WriteInt32BigEndian(ihdr[4..8], height);
        ihdr[8] = 8;
        ihdr[9] = 6;
        ihdr[10] = 0;
        ihdr[11] = 0;
        ihdr[12] = 0;
        WriteChunk(png, "IHDR", ihdr);
        WriteChunk(png, "IDAT", idatBytes);
        WriteChunk(png, "IEND", ReadOnlySpan<byte>.Empty);
        return png.ToArray();
    }

    private static void WriteChunk(Stream stream, string type, ReadOnlySpan<byte> data)
    {
        Span<byte> length = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(length, data.Length);
        stream.Write(length);
        var typeBytes = Encoding.ASCII.GetBytes(type);
        stream.Write(typeBytes);
        stream.Write(data);

        var crc = Crc32.Compute(typeBytes, data);
        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, crc);
        stream.Write(crcBytes);
    }
}

internal static class Crc32
{
    private static readonly uint[] Table = BuildTable();

    public static uint Compute(ReadOnlySpan<byte> type, ReadOnlySpan<byte> data)
    {
        var crc = 0xffffffffu;
        foreach (var b in type) crc = Table[(crc ^ b) & 0xff] ^ (crc >> 8);
        foreach (var b in data) crc = Table[(crc ^ b) & 0xff] ^ (crc >> 8);
        return crc ^ 0xffffffffu;
    }

    private static uint[] BuildTable()
    {
        var table = new uint[256];
        for (uint i = 0; i < table.Length; i++)
        {
            var c = i;
            for (var k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xedb88320u ^ (c >> 1) : c >> 1;
            table[i] = c;
        }
        return table;
    }
}

internal static class PlistDecoder
{
    private static readonly DateTime AppleEpoch = new(2001, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public static bool HasBinaryHeader(ReadOnlySpan<byte> bytes) => bytes.Length >= 8 && bytes[..8].SequenceEqual("bplist00"u8);

    public static bool LooksLikeXmlPlist(ReadOnlySpan<byte> bytes)
    {
        var prefix = Encoding.UTF8.GetString(bytes[..Math.Min(bytes.Length, 128)]);
        return prefix.Contains("<plist", StringComparison.Ordinal) || prefix.Contains("<?xml", StringComparison.Ordinal);
    }

    public static JsonNode? Decode(byte[] bytes)
    {
        if (HasBinaryHeader(bytes)) return new BinaryPlistReader(bytes).Parse();
        if (LooksLikeXmlPlist(bytes)) return ParseXml(bytes);
        throw new InvalidDataException("unsupported plist payload");
    }

    private static JsonNode? ParseXml(byte[] bytes)
    {
        var doc = XDocument.Parse(Encoding.UTF8.GetString(bytes));
        var root = doc.Root?.Elements().FirstOrDefault();
        return root is null ? null : ParseXmlValue(root);
    }

    private static JsonNode? ParseXmlValue(XElement el)
    {
        switch (el.Name.LocalName)
        {
            case "dict":
            {
                var obj = new JsonObject();
                var children = el.Elements().ToList();
                for (var i = 0; i + 1 < children.Count; i += 2)
                {
                    if (children[i].Name.LocalName != "key") continue;
                    obj[children[i].Value] = ParseXmlValue(children[i + 1]);
                }
                return obj;
            }
            case "array":
            {
                var arr = new JsonArray();
                foreach (var child in el.Elements()) arr.Add(ParseXmlValue(child));
                return arr;
            }
            case "string":
            case "date":
                return el.Value;
            case "integer":
                return long.TryParse(el.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l) ? JsonValue.Create(l) : el.Value;
            case "real":
                return double.TryParse(el.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? JsonValue.Create(d) : el.Value;
            case "true":
                return true;
            case "false":
                return false;
            case "data":
                return new JsonObject { ["$data"] = Regex.Replace(el.Value, @"\s+", "") };
            default:
                return el.Value;
        }
    }

    private sealed class BinaryPlistReader(byte[] bytes)
    {
        private readonly int _offsetSize = bytes[^26];
        private readonly int _refSize = bytes[^25];
        private readonly long _objectCount = ReadInt(bytes.AsSpan(bytes.Length - 24, 8));
        private readonly long _topObject = ReadInt(bytes.AsSpan(bytes.Length - 16, 8));
        private readonly long _offsetTableOffset = ReadInt(bytes.AsSpan(bytes.Length - 8, 8));
        private readonly Dictionary<long, JsonNode?> _memo = [];
        private long[]? _offsets;

        public JsonNode? Parse()
        {
            _offsets = new long[_objectCount];
            for (var i = 0; i < _objectCount; i++)
            {
                _offsets[i] = ReadInt(bytes.AsSpan((int)_offsetTableOffset + i * _offsetSize, _offsetSize));
            }
            return ParseObject(_topObject);
        }

        private JsonNode? ParseObject(long index)
        {
            if (_memo.TryGetValue(index, out var memo)) return memo?.DeepClone();
            var offset = checked((int)_offsets![index]);
            var marker = bytes[offset];
            var type = marker >> 4;
            var info = marker & 0x0f;
            JsonNode? value;

            switch (type)
            {
                case 0x0:
                    value = info switch
                    {
                        0x8 => false,
                        0x9 => true,
                        _ => null,
                    };
                    break;
                case 0x1:
                    value = ReadInt(bytes.AsSpan(offset + 1, 1 << info));
                    break;
                case 0x2:
                    value = (1 << info) == 4
                        ? BinaryPrimitives.ReadSingleBigEndian(bytes.AsSpan(offset + 1, 4))
                        : BinaryPrimitives.ReadDoubleBigEndian(bytes.AsSpan(offset + 1, 8));
                    break;
                case 0x3:
                    value = AppleEpoch.AddSeconds(BinaryPrimitives.ReadDoubleBigEndian(bytes.AsSpan(offset + 1, 8))).ToString("O", CultureInfo.InvariantCulture);
                    break;
                case 0x4:
                {
                    var len = ReadLength(info, offset);
                    value = new JsonObject { ["$data"] = Convert.ToBase64String(bytes.AsSpan(len.Offset, len.Length)) };
                    break;
                }
                case 0x5:
                {
                    var len = ReadLength(info, offset);
                    value = Encoding.ASCII.GetString(bytes, len.Offset, len.Length);
                    break;
                }
                case 0x6:
                {
                    var len = ReadLength(info, offset);
                    var chars = new char[len.Length];
                    for (var i = 0; i < len.Length; i++) chars[i] = (char)ReadInt(bytes.AsSpan(len.Offset + i * 2, 2));
                    value = new string(chars);
                    break;
                }
                case 0x8:
                    value = new JsonObject { ["$uid"] = ReadInt(bytes.AsSpan(offset + 1, info + 1)) };
                    break;
                case 0xa:
                {
                    var len = ReadLength(info, offset);
                    var arr = new JsonArray();
                    for (var i = 0; i < len.Length; i++) arr.Add(ParseObject(ReadRef(len.Offset + i * _refSize)));
                    value = arr;
                    break;
                }
                case 0xd:
                {
                    var len = ReadLength(info, offset);
                    var obj = new JsonObject();
                    var valueOffset = len.Offset + len.Length * _refSize;
                    for (var i = 0; i < len.Length; i++)
                    {
                        var key = ParseObject(ReadRef(len.Offset + i * _refSize))?.GetValue<string>() ?? "";
                        obj[key] = ParseObject(ReadRef(valueOffset + i * _refSize));
                    }
                    value = obj;
                    break;
                }
                default:
                    throw new InvalidDataException($"unsupported binary plist type 0x{type:x}");
            }

            _memo[index] = value?.DeepClone();
            return value;
        }

        private (int Length, int Offset) ReadLength(int info, int offset)
        {
            if (info < 0x0f) return (info, offset + 1);
            var marker = bytes[offset + 1];
            if ((marker >> 4) != 0x01) throw new InvalidDataException("invalid binary plist length marker");
            var size = 1 << (marker & 0x0f);
            return ((int)ReadInt(bytes.AsSpan(offset + 2, size)), offset + 2 + size);
        }

        private long ReadRef(int offset) => ReadInt(bytes.AsSpan(offset, _refSize));

        private static long ReadInt(ReadOnlySpan<byte> span)
        {
            long value = 0;
            foreach (var b in span) value = (value << 8) | b;
            return value;
        }
    }
}

internal static class KeyedArchiveResolver
{
    public static (JsonNode? Tree, Dictionary<string, int> ClassCounts) Resolve(JsonNode? root)
    {
        if (root is not JsonObject rootObj) return (root, []);
        var objects = rootObj["$objects"] as JsonArray;
        var rootUid = Uid(rootObj["$top"]?["root"]);
        if (objects is null || rootUid is null) return (root, []);

        var classCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var stack = new HashSet<int>();

        JsonNode? ResolveNode(JsonNode? node, int depth)
        {
            if (depth > 64) return "<depth-limit>";
            var uid = Uid(node);
            if (uid is not null)
            {
                if (!stack.Add(uid.Value)) return "<cycle>";
                var resolved = ResolveNode(objects[uid.Value], depth + 1);
                stack.Remove(uid.Value);
                return resolved;
            }

            if (node is JsonArray arr)
            {
                var outArr = new JsonArray();
                foreach (var item in arr) outArr.Add(ResolveNode(item, depth + 1));
                return outArr;
            }

            if (node is not JsonObject obj) return node?.DeepClone();

            var cls = ClassName(obj);
            if (cls is not null) classCounts[cls] = classCounts.GetValueOrDefault(cls) + 1;

            if (obj["NS.keys"] is JsonArray keys && obj["NS.objects"] is JsonArray values)
            {
                var outObj = new JsonObject();
                if (cls is not null) outObj["__class"] = cls;
                for (var i = 0; i < Math.Min(keys.Count, values.Count); i++)
                {
                    outObj[ResolveNode(keys[i], depth + 1)?.GetValue<string>() ?? ""] = ResolveNode(values[i], depth + 1);
                }
                return outObj;
            }

            if (obj["NS.objects"] is JsonArray nsObjects)
            {
                var outArr = new JsonArray();
                foreach (var item in nsObjects) outArr.Add(ResolveNode(item, depth + 1));
                return outArr;
            }

            var plain = new JsonObject();
            if (cls is not null) plain["__class"] = cls;
            foreach (var (key, value) in obj)
            {
                if (key == "$class") continue;
                plain[key] = ResolveNode(value, depth + 1);
            }
            return plain;
        }

        string? ClassName(JsonObject obj)
        {
            var classUid = Uid(obj["$class"]);
            if (classUid is null || objects[classUid.Value] is not JsonObject classObj) return null;
            return classObj["$classname"]?.GetValue<string>() ?? classObj["$classes"]?[0]?.GetValue<string>();
        }

        return (ResolveNode(new JsonObject { ["$uid"] = rootUid.Value }, 0), classCounts);
    }

    private static int? Uid(JsonNode? node)
    {
        if (node is JsonObject obj && obj["$uid"] is JsonNode uidNode)
        {
            if (uidNode.GetValueKind() == JsonValueKind.Number && uidNode.AsValue().TryGetValue<int>(out var uid)) return uid;
        }
        return null;
    }
}
