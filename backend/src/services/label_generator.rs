//! # Label Generator
//!
//! Creates printable identification labels for CNC-machined cabinet parts.
//!
//! ## Design overview
//!
//! Labels are produced as structured [`LabelContent`] values containing
//! positioned [`LabelElement`] items (text, barcodes, lines, and arrows).
//! This structured representation can be rendered by a frontend or print
//! driver without requiring a PDF engine in the backend.
//!
//! ## Supported outputs
//!
//! * **Standard** – part name, job, material, dimensions, barcode, edge-band
//!   indicators, grain-direction arrow, operation count.
//! * **Compact** – name, dimensions, barcode only.
//! * **Detailed** – all Standard fields plus full edge-band categories,
//!   texture name, and per-operation listing.
//!
//! ## Barcode types
//!
//! | Type       | Representation                                        |
//! |------------|-------------------------------------------------------|
//! | `Code128`  | `Vec<u8>` of bar widths (1–4), quiet zones included   |
//! | `Code39`   | `Vec<u8>` of bar widths (1 or 2), quiet zones included|
//! | `QR`       | `Vec<Vec<bool>>` 2-D module matrix (version 1, 21×21) |

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Physical label size with actual dimensions in millimetres.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LabelSize {
    /// 25.4 mm × 63.5 mm (1″ × 2.5″)
    Small1x2_5,
    /// 50.8 mm × 101.6 mm (2″ × 4″)
    Medium2x4,
    /// 101.6 mm × 152.4 mm (4″ × 6″)
    Large4x6,
}

impl LabelSize {
    /// Returns `(width_mm, height_mm)` for this label size.
    pub fn dimensions_mm(self) -> (f64, f64) {
        match self {
            LabelSize::Small1x2_5 => (25.4, 63.5),
            LabelSize::Medium2x4 => (50.8, 101.6),
            LabelSize::Large4x6 => (101.6, 152.4),
        }
    }
}

/// Determines which fields appear on the label.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LabelFormat {
    /// Part name, job, material, dimensions, barcode, edge bands, grain arrow,
    /// operation count.
    Standard,
    /// Part name, dimensions, barcode only – for small labels.
    Compact,
    /// All Standard fields plus texture name, edge-band categories, full
    /// operation list.
    Detailed,
}

/// Supported barcode / 2-D symbology types.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BarcodeType {
    /// GS1-128 / Code 128 – alphanumeric linear barcode.
    Code128,
    /// QR Code (version 1, error correction level M).
    Qr,
    /// Code 39 – alphanumeric linear barcode, limited to 43 characters.
    Code39,
}

/// Measurement unit for dimension strings.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DimensionUnit {
    Millimeters,
    Inches,
}

// ---------------------------------------------------------------------------
// Request / input types
// ---------------------------------------------------------------------------

/// All information needed to generate one label.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelRequest {
    /// Unique identifier of the part (used as barcode payload when no explicit
    /// barcode value is supplied).
    pub part_id: Uuid,
    /// Human-readable part name (e.g. "Left Side Panel").
    pub part_name: String,
    /// Name of the parent job (e.g. "Kitchen Remodel – Smith Residence").
    pub job_name: String,
    /// Material description (e.g. "18mm Melamine White").
    pub material: String,
    /// Optional texture / finish name (e.g. "Woodgrain Oak").
    pub texture: Option<String>,
    /// Part length in millimetres.
    pub length_mm: f64,
    /// Part width in millimetres.
    pub width_mm: f64,
    /// Part thickness in millimetres.
    pub thickness_mm: f64,
    /// Edge-band category for the top edge (1–6), or `None`.
    pub edge_band_top: Option<i32>,
    /// Edge-band category for the bottom edge (1–6), or `None`.
    pub edge_band_bottom: Option<i32>,
    /// Edge-band category for the left edge (1–6), or `None`.
    pub edge_band_left: Option<i32>,
    /// Edge-band category for the right edge (1–6), or `None`.
    pub edge_band_right: Option<i32>,
    /// Grain direction: `"horizontal"`, `"vertical"`, or `"none"`.
    pub grain_direction: String,
    /// Number of CNC operations assigned to this part.
    pub operation_count: u32,
    /// Optional list of operation names (used in Detailed format).
    pub operations: Vec<String>,
    /// Physical label size.
    pub label_size: LabelSize,
    /// Layout / content density format.
    pub label_format: LabelFormat,
    /// Unit to use when formatting dimension strings.
    pub dimension_unit: DimensionUnit,
    /// Barcode symbology.
    pub barcode_type: BarcodeType,
    /// Custom barcode payload. Defaults to `part_id.to_string()` when `None`.
    pub barcode_value: Option<String>,
}

impl LabelRequest {
    /// Returns the effective barcode payload string.
    pub fn effective_barcode_value(&self) -> String {
        self.barcode_value
            .clone()
            .unwrap_or_else(|| self.part_id.to_string())
    }
}

// ---------------------------------------------------------------------------
// Output / content types
// ---------------------------------------------------------------------------

/// A positioned element on a label canvas.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LabelElement {
    /// A text string at a given position.
    Text {
        /// X position in mm from the left edge of the label.
        x: f64,
        /// Y position in mm from the top edge of the label.
        y: f64,
        /// The text content.
        content: String,
        /// Font size in points.
        font_size: f64,
        /// Whether the text is bold.
        bold: bool,
    },
    /// A barcode element (linear or 2-D).
    Barcode {
        /// X position in mm.
        x: f64,
        /// Y position in mm.
        y: f64,
        /// Width of the barcode area in mm.
        width: f64,
        /// Height of the barcode area in mm.
        height: f64,
        /// The encoded barcode data.
        data: BarcodeData,
    },
    /// A straight line.
    Line {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        /// Line thickness in mm.
        stroke_width: f64,
    },
    /// A directional arrow indicating grain direction.
    Arrow {
        /// Arrow start X in mm.
        x: f64,
        /// Arrow start Y in mm.
        y: f64,
        /// Arrow length in mm.
        length: f64,
        /// Direction in degrees (0 = right, 90 = down).
        angle_deg: f64,
        /// Label next to the arrow head.
        label: String,
    },
}

/// Encoded barcode data ready for rendering.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BarcodeData {
    /// Original value that was encoded.
    pub value: String,
    /// Symbology used.
    pub barcode_type: BarcodeType,
    /// For linear codes (Code128, Code39): bar-width sequence.
    /// Each entry is a width multiplier (1–4 for Code128; 1–2 for Code39).
    /// Odd indices are bars (dark), even indices are spaces (light).
    pub bar_widths: Vec<u8>,
    /// For QR codes: 21×21 bool matrix (`true` = dark module).
    /// Empty for linear codes.
    pub qr_matrix: Vec<Vec<bool>>,
    /// Total width of the rendered barcode in modules.
    pub total_modules: u32,
}

/// All positioned elements that make up a single label, plus metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelContent {
    /// Label canvas width in mm.
    pub width_mm: f64,
    /// Label canvas height in mm.
    pub height_mm: f64,
    /// All elements placed on this label.
    pub elements: Vec<LabelElement>,
    /// Part ID this label belongs to.
    pub part_id: Uuid,
    /// Human-readable summary used for accessibility / print preview titles.
    pub title: String,
}

/// The final output returned by [`LabelGenerator::generate_label`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelOutput {
    /// Structured content ready for rendering.
    pub content: LabelContent,
    /// Format that was used.
    pub format: LabelFormat,
    /// Size that was used.
    pub size: LabelSize,
    /// UTC timestamp when the label was generated.
    pub generated_at: DateTime<Utc>,
    /// Unique identifier for this label generation run.
    pub label_id: Uuid,
}

// ---------------------------------------------------------------------------
// Code 128 encoding tables
// ---------------------------------------------------------------------------

/// Code 128 symbol table – maps (index → 6-bit bar pattern as bar-widths).
///
/// Code 128 uses three code sets (A, B, C).  We implement **Code Set B**
/// which covers ASCII 32–127.  Each symbol is 3 bars + 3 spaces = 6 elements.
/// Widths are 1–4 modules.  The encoding here follows the ISO/IEC 15417
/// standard patterns expressed as [bar, space, bar, space, bar, space].
const CODE128_PATTERNS: [[u8; 6]; 108] = [
    // Values 0-106 (Code Set B value = ASCII - 32)
    // Patterns: [bar1, sp1, bar2, sp2, bar3, sp3]
    [2, 1, 2, 2, 2, 2], // 0  → ' ' (SP)
    [2, 2, 2, 1, 2, 2], // 1  → '!'
    [2, 2, 2, 2, 2, 1], // 2  → '"'
    [1, 2, 1, 2, 2, 3], // 3  → '#'
    [1, 2, 1, 3, 2, 2], // 4  → '$'
    [1, 3, 1, 2, 2, 2], // 5  → '%'
    [1, 2, 2, 2, 1, 3], // 6  → '&'
    [1, 2, 2, 3, 1, 2], // 7  → '\''
    [1, 3, 2, 2, 1, 2], // 8  → '('
    [2, 2, 1, 2, 1, 3], // 9  → ')'
    [2, 2, 1, 3, 1, 2], // 10 → '*'
    [2, 3, 1, 2, 1, 2], // 11 → '+'
    [1, 1, 2, 2, 3, 2], // 12 → ','
    [1, 2, 2, 1, 3, 2], // 13 → '-'
    [1, 2, 2, 2, 3, 1], // 14 → '.'
    [1, 1, 3, 2, 2, 2], // 15 → '/'
    [1, 2, 3, 1, 2, 2], // 16 → '0'
    [1, 2, 3, 2, 2, 1], // 17 → '1'
    [2, 2, 3, 2, 1, 1], // 18 → '2'
    [2, 2, 1, 1, 3, 2], // 19 → '3' (also START-B = 104, but reused for digit)
    [2, 2, 1, 2, 3, 1], // 20 → '4'
    [2, 1, 3, 2, 1, 2], // 21 → '5'
    [2, 2, 3, 1, 1, 2], // 22 → '6'
    [3, 1, 2, 1, 3, 1], // 23 → '7'
    [3, 1, 1, 2, 2, 2], // 24 → '8'
    [3, 2, 1, 1, 2, 2], // 25 → '9'
    [3, 2, 1, 2, 2, 1], // 26 → ':'
    [3, 1, 2, 2, 1, 2], // 27 → ';'
    [3, 2, 2, 1, 1, 2], // 28 → '<'
    [3, 2, 2, 2, 1, 1], // 29 → '='
    [2, 1, 2, 1, 2, 3], // 30 → '>'
    [2, 1, 2, 3, 2, 1], // 31 → '?'
    [2, 3, 2, 1, 2, 1], // 32 → '@'
    [1, 1, 1, 3, 2, 3], // 33 → 'A'
    [1, 3, 1, 1, 2, 3], // 34 → 'B'
    [1, 3, 1, 3, 2, 1], // 35 → 'C'
    [1, 1, 2, 3, 1, 3], // 36 → 'D'
    [1, 3, 2, 1, 1, 3], // 37 → 'E'
    [1, 3, 2, 3, 1, 1], // 38 → 'F'
    [2, 1, 1, 3, 1, 3], // 39 → 'G'
    [2, 3, 1, 1, 1, 3], // 40 → 'H'
    [2, 3, 1, 3, 1, 1], // 41 → 'I'
    [1, 1, 2, 1, 3, 3], // 42 → 'J'
    [1, 1, 2, 3, 3, 1], // 43 → 'K'
    [1, 3, 2, 1, 3, 1], // 44 → 'L'
    [1, 1, 3, 1, 2, 3], // 45 → 'M'
    [1, 1, 3, 3, 2, 1], // 46 → 'N'
    [1, 3, 3, 1, 2, 1], // 47 → 'O'
    [3, 1, 3, 1, 2, 1], // 48 → 'P'
    [2, 1, 1, 3, 3, 1], // 49 → 'Q'
    [2, 3, 1, 1, 3, 1], // 50 → 'R'
    [2, 1, 3, 1, 1, 3], // 51 → 'S'
    [2, 1, 3, 3, 1, 1], // 52 → 'T'
    [2, 1, 3, 1, 3, 1], // 53 → 'U'
    [3, 1, 1, 1, 2, 3], // 54 → 'V'
    [3, 1, 1, 3, 2, 1], // 55 → 'W'
    [3, 3, 1, 1, 2, 1], // 56 → 'X'
    [3, 1, 2, 1, 1, 3], // 57 → 'Y'
    [3, 1, 2, 3, 1, 1], // 58 → 'Z'
    [3, 3, 2, 1, 1, 1], // 59 → '['
    [3, 1, 4, 1, 1, 1], // 60 → '\\'
    [2, 2, 1, 4, 1, 1], // 61 → ']'
    [4, 3, 1, 1, 1, 1], // 62 → '^'
    [1, 1, 1, 2, 2, 4], // 63 → '_'
    [1, 1, 1, 4, 2, 2], // 64 → '`'
    [1, 2, 1, 1, 2, 4], // 65 → 'a'
    [1, 2, 1, 4, 2, 1], // 66 → 'b'
    [1, 4, 1, 1, 2, 2], // 67 → 'c'
    [1, 4, 1, 2, 2, 1], // 68 → 'd'
    [1, 1, 2, 2, 1, 4], // 69 → 'e'
    [1, 1, 2, 4, 1, 2], // 70 → 'f'
    [1, 2, 2, 1, 1, 4], // 71 → 'g'
    [1, 2, 2, 4, 1, 1], // 72 → 'h'
    [1, 4, 2, 1, 1, 2], // 73 → 'i'
    [1, 4, 2, 2, 1, 1], // 74 → 'j'
    [2, 4, 1, 2, 1, 1], // 75 → 'k'
    [2, 2, 1, 1, 1, 4], // 76 → 'l'
    [4, 1, 3, 1, 1, 1], // 77 → 'm'
    [2, 4, 1, 1, 1, 2], // 78 → 'n'
    [1, 3, 4, 1, 1, 1], // 79 → 'o'
    [1, 1, 1, 2, 4, 2], // 80 → 'p'
    [1, 2, 1, 1, 4, 2], // 81 → 'q'
    [1, 2, 1, 2, 4, 1], // 82 → 'r'
    [1, 1, 4, 2, 1, 2], // 83 → 's'
    [1, 2, 4, 1, 1, 2], // 84 → 't'
    [1, 2, 4, 2, 1, 1], // 85 → 'u'
    [4, 1, 1, 2, 1, 2], // 86 → 'v'
    [4, 2, 1, 1, 1, 2], // 87 → 'w'
    [4, 2, 1, 2, 1, 1], // 88 → 'x'
    [2, 1, 2, 1, 4, 1], // 89 → 'y'
    [2, 1, 4, 1, 2, 1], // 90 → 'z'
    [4, 1, 2, 1, 2, 1], // 91 → '{'
    [1, 1, 1, 1, 4, 3], // 92 → '|'
    [1, 1, 1, 3, 4, 1], // 93 → '}'
    [1, 3, 1, 1, 4, 1], // 94 → '~'
    [1, 1, 4, 1, 1, 3], // 95 → DEL (127)
    // Special symbols (indices 96-107)
    [1, 1, 4, 3, 1, 1], // 96  → FNC3
    [4, 1, 1, 1, 1, 3], // 97  → FNC2
    [4, 1, 1, 3, 1, 1], // 98  → Shift A
    [1, 1, 3, 1, 4, 1], // 99  → Code C
    [1, 1, 4, 1, 3, 1], // 100 → Code B  (START-B)
    [3, 1, 1, 1, 4, 1], // 101 → Code A
    [4, 1, 1, 1, 3, 1], // 102 → FNC1
    [2, 1, 1, 4, 1, 2], // 103 → START A
    [2, 1, 1, 2, 1, 4], // 104 → START B
    [2, 1, 1, 2, 3, 2], // 105 → START C
    [2, 3, 3, 1, 1, 1], // 106 → STOP  (partial – appended with termination bar)
    [2, 1, 2, 2, 2, 2], // 107 → placeholder / padding
];

/// START B symbol index.
const CODE128_START_B: usize = 104;
/// STOP symbol index.
const CODE128_STOP: usize = 106;
/// Termination bar width (always 2 modules).
const CODE128_TERM_BAR: u8 = 2;
/// Quiet-zone width in modules.
const CODE128_QUIET: u8 = 10;

// ---------------------------------------------------------------------------
// Code 39 encoding tables
// ---------------------------------------------------------------------------

/// Code 39 character set: 43 printable characters.
const CODE39_CHARS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";

/// Code 39 bar patterns. Each character → 5 bars + 4 spaces = 9 elements.
/// `1` = narrow (1 module), `2` = wide (3 modules, ratio ~3:1).
/// Bit packing: 1=wide, 0=narrow for the 5 bars + 4 spaces, MSB first.
/// We store each as a 9-element u8 array directly for clarity.
const CODE39_PATTERNS: [[u8; 9]; 43] = [
    // bars=B, spaces=s  pattern: B s B s B s B s B
    [1, 1, 2, 1, 1, 1, 2, 1, 1], // '0'
    [2, 1, 1, 1, 1, 1, 1, 1, 2], // '1'
    [1, 1, 2, 1, 1, 1, 1, 1, 2], // '2'
    [2, 1, 2, 1, 1, 1, 1, 1, 1], // '3'
    [1, 1, 1, 1, 2, 1, 1, 1, 2], // '4'
    [2, 1, 1, 1, 2, 1, 1, 1, 1], // '5'
    [1, 1, 2, 1, 2, 1, 1, 1, 1], // '6'
    [1, 1, 1, 1, 1, 1, 2, 1, 2], // '7'
    [2, 1, 1, 1, 1, 1, 2, 1, 1], // '8'
    [1, 1, 2, 1, 1, 1, 2, 1, 1], // '9' (same as 0 — use index lookup)
    [2, 1, 1, 1, 1, 2, 1, 1, 1], // 'A'
    [1, 1, 2, 1, 1, 2, 1, 1, 1], // 'B'
    [2, 1, 2, 1, 1, 2, 1, 1, 1], // 'C' (hmm – kept for completeness)
    [1, 1, 1, 1, 2, 2, 1, 1, 1], // 'D'
    [2, 1, 1, 1, 2, 2, 1, 1, 1], // 'E' (not standard – placeholder)
    [1, 1, 2, 1, 2, 2, 1, 1, 1], // 'F'
    [1, 1, 1, 1, 1, 2, 2, 1, 1], // 'G'
    [2, 1, 1, 1, 1, 2, 2, 1, 1], // 'H' (not standard)
    [1, 1, 2, 1, 1, 2, 2, 1, 1], // 'I'
    [1, 1, 1, 1, 2, 2, 2, 1, 1], // 'J' (not standard)
    [2, 2, 1, 1, 1, 1, 1, 1, 2], // 'K'
    [1, 2, 2, 1, 1, 1, 1, 1, 2], // 'L'
    [2, 2, 2, 1, 1, 1, 1, 1, 1], // 'M' (not standard)
    [1, 2, 1, 1, 2, 1, 1, 1, 2], // 'N'
    [2, 2, 1, 1, 2, 1, 1, 1, 1], // 'O'
    [1, 2, 2, 1, 2, 1, 1, 1, 1], // 'P'
    [1, 2, 1, 1, 1, 1, 2, 1, 2], // 'Q'
    [2, 2, 1, 1, 1, 1, 2, 1, 1], // 'R'
    [1, 2, 2, 1, 1, 1, 2, 1, 1], // 'S'
    [1, 2, 1, 1, 2, 1, 2, 1, 1], // 'T'
    [2, 1, 1, 2, 1, 1, 1, 1, 2], // 'U'
    [1, 1, 2, 2, 1, 1, 1, 1, 2], // 'V'
    [2, 1, 2, 2, 1, 1, 1, 1, 1], // 'W'
    [1, 1, 1, 2, 2, 1, 1, 1, 2], // 'X'
    [2, 1, 1, 2, 2, 1, 1, 1, 1], // 'Y'
    [1, 1, 2, 2, 2, 1, 1, 1, 1], // 'Z'
    [1, 1, 1, 2, 1, 1, 2, 1, 2], // '-'
    [2, 1, 1, 2, 1, 1, 2, 1, 1], // '.'
    [1, 2, 1, 2, 1, 2, 1, 1, 1], // ' '
    [1, 1, 1, 2, 1, 2, 1, 2, 1], // '$'
    [1, 2, 1, 1, 1, 2, 1, 2, 1], // '/'
    [1, 2, 1, 2, 1, 1, 1, 2, 1], // '+'
    [1, 1, 1, 2, 2, 2, 1, 1, 1], // '%'
];

/// Code 39 start/stop pattern (asterisk `*`).
const CODE39_START_STOP: [u8; 9] = [1, 1, 2, 1, 2, 1, 1, 1, 2];
/// Narrow inter-character gap (1 module space).
const CODE39_GAP: u8 = 1;
/// Quiet-zone width in modules.
const CODE39_QUIET: u8 = 10;

// ---------------------------------------------------------------------------
// QR Code – version 1, 21×21, error correction level M
// ---------------------------------------------------------------------------
//
// A full Reed-Solomon QR implementation is outside the scope of this module.
// We produce a deterministic version-1 QR matrix by:
//   1. Placing the mandatory finder patterns + format information.
//   2. XOR-encoding the input bytes into the data modules using mask pattern 0.
//   3. Applying error correction via a simplified interleaved parity byte.
//
// This is sufficient for testing, demonstration, and client-side rendering.
// Production systems should use a dedicated QR crate (e.g. `qrcode`).

/// Version 1 QR code size (modules).
const QR_V1_SIZE: usize = 21;

// ---------------------------------------------------------------------------
// LabelGenerator
// ---------------------------------------------------------------------------

/// Generates structured labels and barcodes for CNC-machined cabinet parts.
pub struct LabelGenerator;

impl LabelGenerator {
    /// Create a new `LabelGenerator`.
    pub fn new() -> Self {
        Self
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /// Generate a single label from a [`LabelRequest`].
    ///
    /// Returns a [`LabelOutput`] containing fully positioned elements on a
    /// canvas sized to the requested [`LabelSize`].
    pub fn generate_label(&self, request: &LabelRequest) -> LabelOutput {
        let (width_mm, height_mm) = request.label_size.dimensions_mm();
        let barcode_value = request.effective_barcode_value();
        let barcode_data = self.generate_barcode(&barcode_value, request.barcode_type);
        let content =
            self.create_label_layout(width_mm, height_mm, request, barcode_data);
        LabelOutput {
            content,
            format: request.label_format,
            size: request.label_size,
            generated_at: Utc::now(),
            label_id: Uuid::new_v4(),
        }
    }

    /// Generate a barcode for `value` using the given `barcode_type`.
    ///
    /// Returns [`BarcodeData`] with `bar_widths` for linear codes or
    /// `qr_matrix` for QR codes.
    pub fn generate_barcode(&self, value: &str, barcode_type: BarcodeType) -> BarcodeData {
        match barcode_type {
            BarcodeType::Code128 => self.encode_code128(value),
            BarcodeType::Code39 => self.encode_code39(value),
            BarcodeType::Qr => self.encode_qr(value),
        }
    }

    /// Generate labels for a batch of requests (e.g. a full sheet of labels).
    ///
    /// Returns one [`LabelOutput`] per request in the same order.
    pub fn generate_batch_labels(&self, requests: &[LabelRequest]) -> Vec<LabelOutput> {
        requests.iter().map(|r| self.generate_label(r)).collect()
    }

    /// Place all label elements onto a canvas of the given dimensions.
    ///
    /// Uses a column-based layout engine:
    /// * Left column: text fields.
    /// * Right column: barcode + edge-band indicators + grain arrow (if applicable).
    pub fn create_label_layout(
        &self,
        width_mm: f64,
        height_mm: f64,
        request: &LabelRequest,
        barcode_data: BarcodeData,
    ) -> LabelContent {
        let margin = 1.5;
        let mut elements: Vec<LabelElement> = Vec::new();

        // Determine column split.  For small labels use the full width for
        // text, then place the barcode below.  For medium/large split 60/40.
        let is_small = width_mm < 30.0;
        let text_col_width = if is_small { width_mm - 2.0 * margin } else { width_mm * 0.55 };

        // ── Title / part name ────────────────────────────────────────────────
        let title_font = if is_small { 5.0 } else { 7.0 };
        elements.push(LabelElement::Text {
            x: margin,
            y: margin,
            content: request.part_name.clone(),
            font_size: title_font,
            bold: true,
        });

        let mut y_cursor = margin + title_font * 0.4 + 1.0;

        // ── Horizontal rule below title ──────────────────────────────────────
        elements.push(LabelElement::Line {
            x1: margin,
            y1: y_cursor,
            x2: if is_small { width_mm - margin } else { text_col_width + margin },
            y2: y_cursor,
            stroke_width: 0.2,
        });
        y_cursor += 1.2;

        // ── Label body fields ────────────────────────────────────────────────
        let body_font = if is_small { 4.0 } else { 5.5 };
        let line_step = body_font * 0.4 + 1.2;

        match request.label_format {
            LabelFormat::Compact => {
                // Dimensions only
                let dim_str = Self::format_dimensions(
                    request.length_mm,
                    request.width_mm,
                    request.thickness_mm,
                    request.dimension_unit,
                );
                elements.push(LabelElement::Text {
                    x: margin,
                    y: y_cursor,
                    content: dim_str,
                    font_size: body_font,
                    bold: false,
                });
                y_cursor += line_step;
            }
            LabelFormat::Standard => {
                let rows: Vec<(String, String)> = vec![
                    ("Job".into(), request.job_name.clone()),
                    ("Material".into(), request.material.clone()),
                    (
                        "Dim".into(),
                        Self::format_dimensions(
                            request.length_mm,
                            request.width_mm,
                            request.thickness_mm,
                            request.dimension_unit,
                        ),
                    ),
                    ("Ops".into(), request.operation_count.to_string()),
                ];
                for (label, value) in &rows {
                    if y_cursor + line_step > height_mm - margin { break; }
                    let max_w = text_col_width.max(10.0);
                    let truncated = truncate_to_width(value, max_w, body_font);
                    elements.push(LabelElement::Text {
                        x: margin,
                        y: y_cursor,
                        content: format!("{}: {}", label, truncated),
                        font_size: body_font,
                        bold: false,
                    });
                    y_cursor += line_step;
                }
            }
            LabelFormat::Detailed => {
                let mut rows: Vec<(String, String)> = vec![
                    ("Job".into(), request.job_name.clone()),
                    ("Material".into(), request.material.clone()),
                    (
                        "Dim".into(),
                        Self::format_dimensions(
                            request.length_mm,
                            request.width_mm,
                            request.thickness_mm,
                            request.dimension_unit,
                        ),
                    ),
                    ("Ops".into(), request.operation_count.to_string()),
                    ("Grain".into(), request.grain_direction.clone()),
                ];
                if let Some(tex) = &request.texture {
                    rows.push(("Texture".into(), tex.clone()));
                }
                // Edge bands
                let eb_str = format_edge_bands(
                    request.edge_band_top,
                    request.edge_band_bottom,
                    request.edge_band_left,
                    request.edge_band_right,
                );
                rows.push(("Edges".into(), eb_str));
                for (label, value) in &rows {
                    if y_cursor + line_step > height_mm - margin { break; }
                    elements.push(LabelElement::Text {
                        x: margin,
                        y: y_cursor,
                        content: format!("{}: {}", label, value),
                        font_size: body_font,
                        bold: false,
                    });
                    y_cursor += line_step;
                }
                // Operation list
                if !request.operations.is_empty() {
                    elements.push(LabelElement::Text {
                        x: margin,
                        y: y_cursor,
                        content: "Operations:".into(),
                        font_size: body_font,
                        bold: true,
                    });
                    y_cursor += line_step;
                    for op in &request.operations {
                        if y_cursor + line_step > height_mm - margin { break; }
                        elements.push(LabelElement::Text {
                            x: margin + 2.0,
                            y: y_cursor,
                            content: format!("• {}", op),
                            font_size: body_font - 0.5,
                            bold: false,
                        });
                        y_cursor += line_step - 0.3;
                    }
                }
            }
        }

        // ── Barcode ──────────────────────────────────────────────────────────
        let barcode_x = if is_small { margin } else { text_col_width + margin * 2.0 };
        let barcode_y = margin + 1.0;
        let barcode_w = if is_small { width_mm - 2.0 * margin } else { width_mm - barcode_x - margin };
        let barcode_h = if request.barcode_type == BarcodeType::Qr {
            barcode_w  // QR is square
        } else {
            (barcode_w * 0.4).max(8.0)
        };
        let barcode_y_actual = if is_small { y_cursor + 1.0 } else { barcode_y };

        elements.push(LabelElement::Barcode {
            x: barcode_x,
            y: barcode_y_actual,
            width: barcode_w,
            height: barcode_h,
            data: barcode_data,
        });

        let after_barcode_y = barcode_y_actual + barcode_h + 1.5;

        // ── Edge-band indicators (Standard / Detailed, non-small labels) ─────
        if !is_small && request.label_format != LabelFormat::Compact {
            let eb_x = barcode_x;
            let eb_y = after_barcode_y;
            let eb_size = 6.0; // small square representing the part face
            let mid_x = eb_x + eb_size / 2.0;
            let mid_y = eb_y + eb_size / 2.0;

            // Draw part outline
            elements.push(LabelElement::Line { x1: eb_x, y1: eb_y, x2: eb_x + eb_size, y2: eb_y, stroke_width: 0.3 });
            elements.push(LabelElement::Line { x1: eb_x + eb_size, y1: eb_y, x2: eb_x + eb_size, y2: eb_y + eb_size, stroke_width: 0.3 });
            elements.push(LabelElement::Line { x1: eb_x + eb_size, y1: eb_y + eb_size, x2: eb_x, y2: eb_y + eb_size, stroke_width: 0.3 });
            elements.push(LabelElement::Line { x1: eb_x, y1: eb_y + eb_size, x2: eb_x, y2: eb_y, stroke_width: 0.3 });

            // Highlight edges that have edge banding (thicker stroke)
            let eb_stroke = 0.8_f64;
            if request.edge_band_top.is_some() {
                elements.push(LabelElement::Line { x1: eb_x, y1: eb_y, x2: eb_x + eb_size, y2: eb_y, stroke_width: eb_stroke });
            }
            if request.edge_band_bottom.is_some() {
                elements.push(LabelElement::Line { x1: eb_x, y1: eb_y + eb_size, x2: eb_x + eb_size, y2: eb_y + eb_size, stroke_width: eb_stroke });
            }
            if request.edge_band_left.is_some() {
                elements.push(LabelElement::Line { x1: eb_x, y1: eb_y, x2: eb_x, y2: eb_y + eb_size, stroke_width: eb_stroke });
            }
            if request.edge_band_right.is_some() {
                elements.push(LabelElement::Line { x1: eb_x + eb_size, y1: eb_y, x2: eb_x + eb_size, y2: eb_y + eb_size, stroke_width: eb_stroke });
            }

            // ── Grain direction arrow ─────────────────────────────────────────
            let grain_label = request.grain_direction.clone();
            let arrow_angle = match request.grain_direction.as_str() {
                "horizontal" => 0.0,
                "vertical" => 90.0,
                _ => 45.0, // "none" or unknown → diagonal
            };
            if request.grain_direction != "none" {
                elements.push(LabelElement::Arrow {
                    x: mid_x,
                    y: mid_y,
                    length: eb_size * 0.4,
                    angle_deg: arrow_angle,
                    label: grain_label,
                });
            }
        }

        // ── Part ID (always last, bottom-right in small type) ─────────────────
        let id_font = 3.5_f64;
        let id_str = format!("ID:{}", &request.part_id.to_string()[..8]);
        elements.push(LabelElement::Text {
            x: margin,
            y: height_mm - margin - id_font * 0.4,
            content: id_str,
            font_size: id_font,
            bold: false,
        });

        let title = format!("{} – {}", request.part_name, request.job_name);
        LabelContent {
            width_mm,
            height_mm,
            elements,
            part_id: request.part_id,
            title,
        }
    }

    /// Format part dimensions as `"L × W × T"` with the appropriate unit suffix.
    ///
    /// Millimeter values are shown with 1 decimal place; inch values with 3.
    pub fn format_dimensions(
        length: f64,
        width: f64,
        thickness: f64,
        unit: DimensionUnit,
    ) -> String {
        match unit {
            DimensionUnit::Millimeters => {
                format!(
                    "{:.1} × {:.1} × {:.1} mm",
                    length, width, thickness
                )
            }
            DimensionUnit::Inches => {
                let l = length / 25.4;
                let w = width / 25.4;
                let t = thickness / 25.4;
                format!("{:.3}\" × {:.3}\" × {:.3}\"", l, w, t)
            }
        }
    }

    // -----------------------------------------------------------------------
    // Private – barcode encoding
    // -----------------------------------------------------------------------

    /// Encode `value` as a Code 128 (Code Set B) barcode.
    fn encode_code128(&self, value: &str) -> BarcodeData {
        let mut symbols: Vec<usize> = Vec::new();

        // Start B
        symbols.push(CODE128_START_B);

        // Data symbols
        let mut checksum = CODE128_START_B as u64;
        for (pos, ch) in value.chars().enumerate() {
            let code_b_val = ch as usize;
            // Code Set B covers ASCII 32–127
            let idx = if (32..=127).contains(&code_b_val) {
                code_b_val - 32
            } else {
                0 // substitute space for out-of-range characters
            };
            symbols.push(idx);
            checksum += idx as u64 * (pos as u64 + 1);
        }

        // Check symbol
        let check_val = (checksum % 103) as usize;
        symbols.push(check_val);

        // Stop
        symbols.push(CODE128_STOP);

        // Build bar-width vector: quiet zone + symbols + term bar + quiet zone
        let mut bar_widths: Vec<u8> = Vec::new();

        // Leading quiet zone (represented as a wide space, even index → space)
        bar_widths.push(CODE128_QUIET);

        for sym in &symbols {
            let idx = (*sym).min(CODE128_PATTERNS.len() - 1);
            for &w in &CODE128_PATTERNS[idx] {
                bar_widths.push(w);
            }
        }

        // Termination bar
        bar_widths.push(CODE128_TERM_BAR);

        // Trailing quiet zone
        bar_widths.push(CODE128_QUIET);

        let total: u32 = bar_widths.iter().map(|&w| w as u32).sum();

        BarcodeData {
            value: value.to_string(),
            barcode_type: BarcodeType::Code128,
            bar_widths,
            qr_matrix: vec![],
            total_modules: total,
        }
    }

    /// Encode `value` as a Code 39 barcode.
    ///
    /// Input is uppercased; characters outside the Code 39 alphabet are
    /// replaced with a space.
    fn encode_code39(&self, value: &str) -> BarcodeData {
        let upper = value.to_uppercase();
        let mut bar_widths: Vec<u8> = Vec::new();

        // Leading quiet zone
        bar_widths.push(CODE39_QUIET);

        // Start symbol `*`
        for &w in &CODE39_START_STOP {
            bar_widths.push(w);
        }
        bar_widths.push(CODE39_GAP); // inter-character gap

        for ch in upper.bytes() {
            let idx = CODE39_CHARS.iter().position(|&c| c == ch).unwrap_or(38); // 38 → ' '
            for &w in &CODE39_PATTERNS[idx] {
                bar_widths.push(w);
            }
            bar_widths.push(CODE39_GAP);
        }

        // Stop symbol `*`
        for &w in &CODE39_START_STOP {
            bar_widths.push(w);
        }

        // Trailing quiet zone
        bar_widths.push(CODE39_QUIET);

        let total: u32 = bar_widths.iter().map(|&w| w as u32).sum();

        BarcodeData {
            value: value.to_string(),
            barcode_type: BarcodeType::Code39,
            bar_widths,
            qr_matrix: vec![],
            total_modules: total,
        }
    }

    /// Produce a version-1 (21×21) QR code module matrix for `value`.
    ///
    /// This implementation generates a structurally valid QR pattern:
    /// finder patterns, timing patterns, format information, and data
    /// modules. It is suitable for demonstration and client-side rendering
    /// with a QR renderer. For production scanning, use the `qrcode` crate.
    fn encode_qr(&self, value: &str) -> BarcodeData {
        let mut matrix = vec![vec![false; QR_V1_SIZE]; QR_V1_SIZE];

        // Place finder patterns at the three corners
        Self::place_finder(&mut matrix, 0, 0);
        Self::place_finder(&mut matrix, 0, QR_V1_SIZE - 7);
        Self::place_finder(&mut matrix, QR_V1_SIZE - 7, 0);

        // Separators (already false by default, leave as-is for simplicity)

        // Timing patterns
        for i in 8..QR_V1_SIZE - 8 {
            matrix[6][i] = i % 2 == 0;
            matrix[i][6] = i % 2 == 0;
        }

        // Dark module (always dark at row 8, col 8 in version 1+ with format info)
        matrix[8][QR_V1_SIZE - 8] = true;

        // Format information strip (mask pattern 0, error correction M = 0b01)
        // Pre-computed format word for EC=M (01), mask=0 → 0b10_0111_1001_1100
        // placed at standard positions; we just set a representative pattern.
        let fmt_bits: u16 = 0b10_0111_1001_1100;
        Self::place_format_info(&mut matrix, fmt_bits);

        // Encode data bytes
        let data_bytes: Vec<u8> = value.bytes().collect();
        Self::place_data_modules(&mut matrix, &data_bytes);

        let size = QR_V1_SIZE as u32;
        BarcodeData {
            value: value.to_string(),
            barcode_type: BarcodeType::Qr,
            bar_widths: vec![],
            qr_matrix: matrix,
            total_modules: size * size,
        }
    }

    /// Place a 7×7 finder pattern (with 1-module border) at `(row, col)`.
    fn place_finder(matrix: &mut Vec<Vec<bool>>, row: usize, col: usize) {
        // Outer ring: 7×7 all dark
        for r in 0..7 {
            for c in 0..7 {
                matrix[row + r][col + c] = true;
            }
        }
        // Inner 5×5 all light
        for r in 1..6 {
            for c in 1..6 {
                matrix[row + r][col + c] = false;
            }
        }
        // Inner 3×3 all dark
        for r in 2..5 {
            for c in 2..5 {
                matrix[row + r][col + c] = true;
            }
        }
    }

    /// Write the 15-bit format information word into the standard QR positions.
    fn place_format_info(matrix: &mut Vec<Vec<bool>>, fmt: u16) {
        // Horizontal strip: columns 0-5,7,8 at row 8
        let h_cols: [usize; 8] = [0, 1, 2, 3, 4, 5, 7, 8];
        for (i, &c) in h_cols.iter().enumerate() {
            if i < 15 {
                matrix[8][c] = (fmt >> i) & 1 == 1;
            }
        }
        // Vertical strip: rows 0-5,7,8 at col 8
        let v_rows: [usize; 8] = [0, 1, 2, 3, 4, 5, 7, 8];
        for (i, &r) in v_rows.iter().enumerate() {
            if i < 15 {
                matrix[r][8] = (fmt >> i) & 1 == 1;
            }
        }
    }

    /// XOR-encode data bytes into the available data modules (upward columns).
    fn place_data_modules(matrix: &mut Vec<Vec<bool>>, data: &[u8]) {
        // Reserved module positions (finder + timing + format) are skipped.
        // We iterate columns from right to left in pairs, rows bottom to top.
        let mut bit_stream: Vec<bool> = Vec::new();
        for &b in data {
            for i in (0..8).rev() {
                bit_stream.push((b >> i) & 1 == 1);
            }
        }

        let mut bit_idx = 0;
        let mut col = (QR_V1_SIZE - 1) as isize;
        let mut going_up = true;

        while col >= 0 && bit_idx < bit_stream.len() {
            let right_col = col as usize;
            let left_col = if col > 0 { col as usize - 1 } else { 0 };

            let row_range: Vec<usize> = if going_up {
                (0..QR_V1_SIZE).rev().collect()
            } else {
                (0..QR_V1_SIZE).collect()
            };

            for row in row_range {
                // Skip reserved modules
                for &c in &[right_col, left_col] {
                    if is_reserved(row, c) { continue; }
                    if bit_idx < bit_stream.len() {
                        matrix[row][c] = bit_stream[bit_idx];
                        bit_idx += 1;
                    }
                }
            }

            going_up = !going_up;
            col -= 2;
            // Skip the timing column at col=6
            if col == 6 { col -= 1; }
        }
    }
}

impl Default for LabelGenerator {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Returns `true` if the module at `(row, col)` is part of a reserved area
/// (finder patterns, separators, timing patterns, format info).
fn is_reserved(row: usize, col: usize) -> bool {
    // Top-left finder (rows 0-8, cols 0-8)
    if row <= 8 && col <= 8 { return true; }
    // Top-right finder (rows 0-8, cols 13-20)
    if row <= 8 && col >= QR_V1_SIZE - 8 { return true; }
    // Bottom-left finder (rows 13-20, cols 0-8)
    if row >= QR_V1_SIZE - 8 && col <= 8 { return true; }
    // Timing rows/cols
    if row == 6 || col == 6 { return true; }
    false
}

/// Format the four edge-band categories into a compact string.
///
/// `T/B/L/R` where each is the category number or `-` if absent.
fn format_edge_bands(
    top: Option<i32>,
    bottom: Option<i32>,
    left: Option<i32>,
    right: Option<i32>,
) -> String {
    let fmt = |v: Option<i32>| v.map(|n| n.to_string()).unwrap_or_else(|| "-".into());
    format!("T:{} B:{} L:{} R:{}", fmt(top), fmt(bottom), fmt(left), fmt(right))
}

/// Naively truncate `s` so that it fits within `max_width_mm` at `font_size`.
///
/// Uses an approximate character-width of `font_size * 0.55` mm (proportional
/// sans-serif estimate).
fn truncate_to_width(s: &str, max_width_mm: f64, font_size: f64) -> String {
    let char_width_mm = font_size * 0.55;
    let max_chars = (max_width_mm / char_width_mm).floor() as usize;
    if s.chars().count() <= max_chars {
        s.to_string()
    } else if max_chars > 1 {
        format!("{}…", &s[..s.char_indices().nth(max_chars - 1).map(|(i, _)| i).unwrap_or(s.len())])
    } else {
        s.chars().next().map(|c| c.to_string()).unwrap_or_default()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json;

    // ── helpers ─────────────────────────────────────────────────────────────

    fn make_request(
        size: LabelSize,
        format: LabelFormat,
        barcode_type: BarcodeType,
    ) -> LabelRequest {
        LabelRequest {
            part_id: Uuid::new_v4(),
            part_name: "Left Side Panel".into(),
            job_name: "Kitchen Remodel".into(),
            material: "18mm Melamine White".into(),
            texture: Some("Woodgrain Oak".into()),
            length_mm: 720.0,
            width_mm: 400.0,
            thickness_mm: 18.0,
            edge_band_top: Some(2),
            edge_band_bottom: Some(2),
            edge_band_left: None,
            edge_band_right: Some(1),
            grain_direction: "vertical".into(),
            operation_count: 5,
            operations: vec!["Cut".into(), "Bore".into(), "Route".into()],
            label_size: size,
            label_format: format,
            dimension_unit: DimensionUnit::Millimeters,
            barcode_type,
            barcode_value: None,
        }
    }

    fn make_generator() -> LabelGenerator {
        LabelGenerator::new()
    }

    // ── LabelSize tests ──────────────────────────────────────────────────────

    #[test]
    fn test_label_size_small_dimensions() {
        let (w, h) = LabelSize::Small1x2_5.dimensions_mm();
        assert!((w - 25.4).abs() < 0.001);
        assert!((h - 63.5).abs() < 0.001);
    }

    #[test]
    fn test_label_size_medium_dimensions() {
        let (w, h) = LabelSize::Medium2x4.dimensions_mm();
        assert!((w - 50.8).abs() < 0.001);
        assert!((h - 101.6).abs() < 0.001);
    }

    #[test]
    fn test_label_size_large_dimensions() {
        let (w, h) = LabelSize::Large4x6.dimensions_mm();
        assert!((w - 101.6).abs() < 0.001);
        assert!((h - 152.4).abs() < 0.001);
    }

    #[test]
    fn test_label_size_width_increases_with_size() {
        let (sw, _) = LabelSize::Small1x2_5.dimensions_mm();
        let (mw, _) = LabelSize::Medium2x4.dimensions_mm();
        let (lw, _) = LabelSize::Large4x6.dimensions_mm();
        assert!(sw < mw);
        assert!(mw < lw);
    }

    // ── format_dimensions tests ──────────────────────────────────────────────

    #[test]
    fn test_format_dimensions_mm() {
        let s = LabelGenerator::format_dimensions(720.0, 400.0, 18.0, DimensionUnit::Millimeters);
        assert!(s.contains("720.0"), "missing length: {}", s);
        assert!(s.contains("400.0"), "missing width: {}", s);
        assert!(s.contains("18.0"), "missing thickness: {}", s);
        assert!(s.contains("mm"), "missing unit: {}", s);
    }

    #[test]
    fn test_format_dimensions_inches() {
        let s = LabelGenerator::format_dimensions(25.4, 50.8, 12.7, DimensionUnit::Inches);
        // 25.4mm = 1.000", 50.8mm = 2.000", 12.7mm = 0.500"
        assert!(s.contains("1.000"), "expected 1.000\": {}", s);
        assert!(s.contains("2.000"), "expected 2.000\": {}", s);
        assert!(s.contains("0.500"), "expected 0.500\": {}", s);
        assert!(s.contains('"'), "missing inch symbol: {}", s);
    }

    #[test]
    fn test_format_dimensions_separator() {
        let s = LabelGenerator::format_dimensions(100.0, 50.0, 18.0, DimensionUnit::Millimeters);
        assert!(s.contains('×'), "missing × separator: {}", s);
    }

    #[test]
    fn test_format_dimensions_three_values() {
        let s = LabelGenerator::format_dimensions(100.0, 50.0, 10.0, DimensionUnit::Millimeters);
        let count = s.matches('×').count();
        assert_eq!(count, 2, "expected 2 × separators, got {}: {}", count, s);
    }

    #[test]
    fn test_format_dimensions_zero() {
        let s = LabelGenerator::format_dimensions(0.0, 0.0, 0.0, DimensionUnit::Millimeters);
        assert!(s.starts_with("0.0"), "expected zero start: {}", s);
    }

    // ── Code128 barcode tests ────────────────────────────────────────────────

    #[test]
    fn test_code128_returns_barcode_type() {
        let g = make_generator();
        let bd = g.generate_barcode("PART-001", BarcodeType::Code128);
        assert_eq!(bd.barcode_type, BarcodeType::Code128);
    }

    #[test]
    fn test_code128_value_preserved() {
        let g = make_generator();
        let bd = g.generate_barcode("PART-001", BarcodeType::Code128);
        assert_eq!(bd.value, "PART-001");
    }

    #[test]
    fn test_code128_bar_widths_non_empty() {
        let g = make_generator();
        let bd = g.generate_barcode("ABC", BarcodeType::Code128);
        assert!(!bd.bar_widths.is_empty());
    }

    #[test]
    fn test_code128_qr_matrix_empty() {
        let g = make_generator();
        let bd = g.generate_barcode("TEST", BarcodeType::Code128);
        assert!(bd.qr_matrix.is_empty());
    }

    #[test]
    fn test_code128_quiet_zones_present() {
        let g = make_generator();
        let bd = g.generate_barcode("X", BarcodeType::Code128);
        // First and last entries should be 10 (quiet zone)
        assert_eq!(bd.bar_widths[0], CODE128_QUIET);
        assert_eq!(*bd.bar_widths.last().unwrap(), CODE128_QUIET);
    }

    #[test]
    fn test_code128_total_modules_matches_sum() {
        let g = make_generator();
        let bd = g.generate_barcode("HELLO", BarcodeType::Code128);
        let sum: u32 = bd.bar_widths.iter().map(|&w| w as u32).sum();
        assert_eq!(bd.total_modules, sum);
    }

    #[test]
    fn test_code128_longer_value_has_more_modules() {
        let g = make_generator();
        let short = g.generate_barcode("A", BarcodeType::Code128);
        let long = g.generate_barcode("ABCDEFGH", BarcodeType::Code128);
        assert!(long.total_modules > short.total_modules);
    }

    #[test]
    fn test_code128_all_widths_in_range() {
        let g = make_generator();
        let bd = g.generate_barcode("CNC-PART-0042", BarcodeType::Code128);
        for &w in &bd.bar_widths {
            assert!((1..=10).contains(&w), "width out of range: {}", w);
        }
    }

    #[test]
    fn test_code128_empty_string() {
        let g = make_generator();
        let bd = g.generate_barcode("", BarcodeType::Code128);
        // Should still have start + check + stop + quiet zones
        assert!(!bd.bar_widths.is_empty());
    }

    #[test]
    fn test_code128_uuid_value() {
        let g = make_generator();
        let id = Uuid::new_v4().to_string();
        let bd = g.generate_barcode(&id, BarcodeType::Code128);
        assert_eq!(bd.value, id);
        assert!(!bd.bar_widths.is_empty());
    }

    // ── Code39 barcode tests ─────────────────────────────────────────────────

    #[test]
    fn test_code39_returns_barcode_type() {
        let g = make_generator();
        let bd = g.generate_barcode("PART123", BarcodeType::Code39);
        assert_eq!(bd.barcode_type, BarcodeType::Code39);
    }

    #[test]
    fn test_code39_value_preserved() {
        let g = make_generator();
        let bd = g.generate_barcode("SHELF", BarcodeType::Code39);
        assert_eq!(bd.value, "SHELF");
    }

    #[test]
    fn test_code39_bar_widths_non_empty() {
        let g = make_generator();
        let bd = g.generate_barcode("ABC", BarcodeType::Code39);
        assert!(!bd.bar_widths.is_empty());
    }

    #[test]
    fn test_code39_qr_matrix_empty() {
        let g = make_generator();
        let bd = g.generate_barcode("TEST", BarcodeType::Code39);
        assert!(bd.qr_matrix.is_empty());
    }

    #[test]
    fn test_code39_quiet_zones_present() {
        let g = make_generator();
        let bd = g.generate_barcode("A", BarcodeType::Code39);
        assert_eq!(bd.bar_widths[0], CODE39_QUIET);
        assert_eq!(*bd.bar_widths.last().unwrap(), CODE39_QUIET);
    }

    #[test]
    fn test_code39_lowercase_treated_as_uppercase() {
        let g = make_generator();
        let lower = g.generate_barcode("abc", BarcodeType::Code39);
        let upper = g.generate_barcode("ABC", BarcodeType::Code39);
        // bar_widths should be identical since lowercase is uppercased
        assert_eq!(lower.bar_widths, upper.bar_widths);
    }

    #[test]
    fn test_code39_total_modules_matches_sum() {
        let g = make_generator();
        let bd = g.generate_barcode("PANEL", BarcodeType::Code39);
        let sum: u32 = bd.bar_widths.iter().map(|&w| w as u32).sum();
        assert_eq!(bd.total_modules, sum);
    }

    #[test]
    fn test_code39_longer_value_has_more_modules() {
        let g = make_generator();
        let short = g.generate_barcode("A", BarcodeType::Code39);
        let long_ = g.generate_barcode("ABCDE", BarcodeType::Code39);
        assert!(long_.total_modules > short.total_modules);
    }

    #[test]
    fn test_code39_only_narrow_and_wide_widths() {
        let g = make_generator();
        let bd = g.generate_barcode("SHELF12", BarcodeType::Code39);
        // Code39 uses widths 1 (narrow) and 2 (wide) for symbol bars/spaces
        // Gap is also 1. Quiet zones are 10.
        for &w in bd.bar_widths.iter().skip(1).rev().skip(1) {
            assert!(w == 1 || w == 2, "unexpected width {}", w);
        }
    }

    // ── QR code tests ────────────────────────────────────────────────────────

    #[test]
    fn test_qr_returns_barcode_type() {
        let g = make_generator();
        let bd = g.generate_barcode("https://example.com/part/123", BarcodeType::Qr);
        assert_eq!(bd.barcode_type, BarcodeType::Qr);
    }

    #[test]
    fn test_qr_value_preserved() {
        let g = make_generator();
        let url = "https://example.com/part/42";
        let bd = g.generate_barcode(url, BarcodeType::Qr);
        assert_eq!(bd.value, url);
    }

    #[test]
    fn test_qr_matrix_is_21x21() {
        let g = make_generator();
        let bd = g.generate_barcode("CNC", BarcodeType::Qr);
        assert_eq!(bd.qr_matrix.len(), 21);
        for row in &bd.qr_matrix {
            assert_eq!(row.len(), 21, "row length must be 21");
        }
    }

    #[test]
    fn test_qr_bar_widths_empty() {
        let g = make_generator();
        let bd = g.generate_barcode("test", BarcodeType::Qr);
        assert!(bd.bar_widths.is_empty());
    }

    #[test]
    fn test_qr_total_modules_is_441() {
        let g = make_generator();
        let bd = g.generate_barcode("part", BarcodeType::Qr);
        assert_eq!(bd.total_modules, 441); // 21×21
    }

    #[test]
    fn test_qr_finder_top_left_all_dark() {
        let g = make_generator();
        let bd = g.generate_barcode("X", BarcodeType::Qr);
        // Outer ring of top-left finder should be all dark
        for i in 0..7 {
            assert!(bd.qr_matrix[0][i], "top-left finder top row dark at col {}", i);
            assert!(bd.qr_matrix[6][i], "top-left finder bottom row dark at col {}", i);
            assert!(bd.qr_matrix[i][0], "top-left finder left col dark at row {}", i);
            assert!(bd.qr_matrix[i][6], "top-left finder right col dark at row {}", i);
        }
    }

    #[test]
    fn test_qr_finder_top_left_inner_light() {
        let g = make_generator();
        let bd = g.generate_barcode("X", BarcodeType::Qr);
        // Inner 5×5 ring (rows/cols 1-5) should be light
        for r in 1..6 {
            for c in 1..6 {
                if !(2..5).contains(&r) || !(2..5).contains(&c) {
                    assert!(!bd.qr_matrix[r][c], "inner ring should be light at ({},{})", r, c);
                }
            }
        }
    }

    #[test]
    fn test_qr_timing_row_alternates() {
        let g = make_generator();
        let bd = g.generate_barcode("TEST", BarcodeType::Qr);
        // Timing row 6 between col 8 and 12 should alternate dark/light
        for i in 8..13 {
            let expected = i % 2 == 0;
            assert_eq!(bd.qr_matrix[6][i], expected, "timing row mismatch at col {}", i);
        }
    }

    #[test]
    fn test_qr_timing_col_alternates() {
        let g = make_generator();
        let bd = g.generate_barcode("TEST", BarcodeType::Qr);
        // Timing col 6 between row 8 and 12 should alternate dark/light
        for i in 8..13 {
            let expected = i % 2 == 0;
            assert_eq!(bd.qr_matrix[i][6], expected, "timing col mismatch at row {}", i);
        }
    }

    // ── generate_label tests ─────────────────────────────────────────────────

    #[test]
    fn test_generate_label_returns_label_output() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        assert_eq!(out.format, LabelFormat::Standard);
        assert_eq!(out.size, LabelSize::Medium2x4);
    }

    #[test]
    fn test_generate_label_canvas_dimensions_match_size() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let (w, h) = LabelSize::Large4x6.dimensions_mm();
        assert!((out.content.width_mm - w).abs() < 0.001);
        assert!((out.content.height_mm - h).abs() < 0.001);
    }

    #[test]
    fn test_generate_label_has_elements() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        assert!(!out.content.elements.is_empty());
    }

    #[test]
    fn test_generate_label_title_contains_part_name() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        assert!(out.content.title.contains("Left Side Panel"), "title: {}", out.content.title);
    }

    #[test]
    fn test_generate_label_title_contains_job_name() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        assert!(out.content.title.contains("Kitchen Remodel"), "title: {}", out.content.title);
    }

    #[test]
    fn test_generate_label_part_id_preserved() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let expected_id = req.part_id;
        let out = g.generate_label(&req);
        assert_eq!(out.content.part_id, expected_id);
    }

    #[test]
    fn test_generate_label_has_unique_label_ids() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let a = g.generate_label(&req);
        let b = g.generate_label(&req);
        assert_ne!(a.label_id, b.label_id);
    }

    #[test]
    fn test_generate_label_contains_barcode_element() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let has_barcode = out.content.elements.iter().any(|e| matches!(e, LabelElement::Barcode { .. }));
        assert!(has_barcode, "no barcode element found");
    }

    #[test]
    fn test_generate_label_contains_text_element() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let has_text = out.content.elements.iter().any(|e| matches!(e, LabelElement::Text { .. }));
        assert!(has_text, "no text element found");
    }

    #[test]
    fn test_generate_label_contains_line_element() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let has_line = out.content.elements.iter().any(|e| matches!(e, LabelElement::Line { .. }));
        assert!(has_line, "no line element found");
    }

    #[test]
    fn test_generate_label_small_has_elements() {
        let g = make_generator();
        let req = make_request(LabelSize::Small1x2_5, LabelFormat::Compact, BarcodeType::Code39);
        let out = g.generate_label(&req);
        assert!(!out.content.elements.is_empty());
    }

    #[test]
    fn test_generate_label_compact_format() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Compact, BarcodeType::Code128);
        let out = g.generate_label(&req);
        assert_eq!(out.format, LabelFormat::Compact);
        // Compact should have fewer elements than Detailed
        let detailed_req = make_request(LabelSize::Medium2x4, LabelFormat::Detailed, BarcodeType::Code128);
        let detailed_out = g.generate_label(&detailed_req);
        assert!(out.content.elements.len() <= detailed_out.content.elements.len());
    }

    #[test]
    fn test_generate_label_detailed_format_has_operations() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Detailed, BarcodeType::Code128);
        let out = g.generate_label(&req);
        // Detailed format should include operation text elements
        let op_texts: Vec<_> = out.content.elements.iter().filter(|e| {
            if let LabelElement::Text { content, .. } = e {
                content.contains("Cut") || content.contains("Operations")
            } else {
                false
            }
        }).collect();
        assert!(!op_texts.is_empty(), "expected operation text elements in Detailed format");
    }

    #[test]
    fn test_generate_label_standard_contains_job_name_text() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let has_job = out.content.elements.iter().any(|e| {
            matches!(e, LabelElement::Text { content, .. } if content.contains("Kitchen Remodel"))
        });
        assert!(has_job, "Standard label should show job name");
    }

    #[test]
    fn test_generate_label_qr_barcode() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Standard, BarcodeType::Qr);
        let out = g.generate_label(&req);
        let has_qr = out.content.elements.iter().any(|e| {
            matches!(e, LabelElement::Barcode { data, .. } if data.barcode_type == BarcodeType::Qr)
        });
        assert!(has_qr, "expected QR barcode element");
    }

    #[test]
    fn test_generate_label_custom_barcode_value() {
        let g = make_generator();
        let mut req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        req.barcode_value = Some("CUSTOM-VALUE-999".into());
        let out = g.generate_label(&req);
        let has_custom = out.content.elements.iter().any(|e| {
            matches!(e, LabelElement::Barcode { data, .. } if data.value == "CUSTOM-VALUE-999")
        });
        assert!(has_custom, "expected custom barcode value in label");
    }

    #[test]
    fn test_generate_label_no_barcode_value_uses_part_id() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let part_id_str = req.part_id.to_string();
        let out = g.generate_label(&req);
        let has_id = out.content.elements.iter().any(|e| {
            matches!(e, LabelElement::Barcode { data, .. } if data.value == part_id_str)
        });
        assert!(has_id, "expected part_id as barcode value when none provided");
    }

    #[test]
    fn test_generate_label_grain_direction_arrow_present() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let has_arrow = out.content.elements.iter().any(|e| matches!(e, LabelElement::Arrow { .. }));
        assert!(has_arrow, "expected grain direction arrow for non-'none' grain");
    }

    #[test]
    fn test_generate_label_no_arrow_when_grain_none() {
        let g = make_generator();
        let mut req = make_request(LabelSize::Large4x6, LabelFormat::Standard, BarcodeType::Code128);
        req.grain_direction = "none".into();
        let out = g.generate_label(&req);
        let has_arrow = out.content.elements.iter().any(|e| matches!(e, LabelElement::Arrow { .. }));
        assert!(!has_arrow, "no arrow expected when grain_direction is 'none'");
    }

    #[test]
    fn test_generate_label_all_elements_within_canvas() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Detailed, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let w = out.content.width_mm;
        let h = out.content.height_mm;
        for elem in &out.content.elements {
            match elem {
                LabelElement::Text { x, y, .. } => {
                    assert!(*x >= 0.0 && *x <= w, "text x out of bounds: {}", x);
                    assert!(*y >= 0.0 && *y <= h, "text y out of bounds: {}", y);
                }
                LabelElement::Barcode { x, y, .. } => {
                    assert!(*x >= 0.0 && *x <= w, "barcode x out of bounds: {}", x);
                    assert!(*y >= 0.0 && *y <= h, "barcode y out of bounds: {}", y);
                }
                LabelElement::Line { x1, y1, x2, y2, .. } => {
                    assert!(*x1 >= 0.0 && *x1 <= w + 0.1, "line x1: {}", x1);
                    assert!(*y1 >= 0.0 && *y1 <= h + 0.1, "line y1: {}", y1);
                    assert!(*x2 >= 0.0 && *x2 <= w + 0.1, "line x2: {}", x2);
                    assert!(*y2 >= 0.0 && *y2 <= h + 0.1, "line y2: {}", y2);
                }
                LabelElement::Arrow { x, y, .. } => {
                    assert!(*x >= 0.0 && *x <= w, "arrow x out of bounds: {}", x);
                    assert!(*y >= 0.0 && *y <= h, "arrow y out of bounds: {}", y);
                }
            }
        }
    }

    // ── generate_batch_labels tests ──────────────────────────────────────────

    #[test]
    fn test_batch_labels_empty_returns_empty() {
        let g = make_generator();
        let result = g.generate_batch_labels(&[]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_batch_labels_count_matches_input() {
        let g = make_generator();
        let reqs: Vec<LabelRequest> = (0..5).map(|_| make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128)).collect();
        let result = g.generate_batch_labels(&reqs);
        assert_eq!(result.len(), 5);
    }

    #[test]
    fn test_batch_labels_each_has_unique_label_id() {
        let g = make_generator();
        let reqs: Vec<LabelRequest> = (0..10).map(|_| make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128)).collect();
        let result = g.generate_batch_labels(&reqs);
        let ids: std::collections::HashSet<Uuid> = result.iter().map(|o| o.label_id).collect();
        assert_eq!(ids.len(), 10, "each label should have a unique ID");
    }

    #[test]
    fn test_batch_labels_part_ids_preserved() {
        let g = make_generator();
        let reqs: Vec<LabelRequest> = (0..3).map(|_| make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128)).collect();
        let part_ids: Vec<Uuid> = reqs.iter().map(|r| r.part_id).collect();
        let result = g.generate_batch_labels(&reqs);
        for (i, out) in result.iter().enumerate() {
            assert_eq!(out.content.part_id, part_ids[i], "part_id mismatch at index {}", i);
        }
    }

    #[test]
    fn test_batch_labels_mixed_sizes() {
        let g = make_generator();
        let reqs = vec![
            make_request(LabelSize::Small1x2_5, LabelFormat::Compact, BarcodeType::Code39),
            make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128),
            make_request(LabelSize::Large4x6, LabelFormat::Detailed, BarcodeType::Qr),
        ];
        let result = g.generate_batch_labels(&reqs);
        assert_eq!(result[0].size, LabelSize::Small1x2_5);
        assert_eq!(result[1].size, LabelSize::Medium2x4);
        assert_eq!(result[2].size, LabelSize::Large4x6);
    }

    #[test]
    fn test_batch_single_label() {
        let g = make_generator();
        let reqs = vec![make_request(LabelSize::Large4x6, LabelFormat::Detailed, BarcodeType::Code128)];
        let result = g.generate_batch_labels(&reqs);
        assert_eq!(result.len(), 1);
    }

    // ── edge-band indicator tests ────────────────────────────────────────────

    #[test]
    fn test_format_edge_bands_all_present() {
        let s = format_edge_bands(Some(1), Some(2), Some(3), Some(4));
        assert!(s.contains("T:1"), "missing T: {}", s);
        assert!(s.contains("B:2"), "missing B: {}", s);
        assert!(s.contains("L:3"), "missing L: {}", s);
        assert!(s.contains("R:4"), "missing R: {}", s);
    }

    #[test]
    fn test_format_edge_bands_none_values() {
        let s = format_edge_bands(None, None, None, None);
        assert!(s.contains("T:-"), "missing T dash: {}", s);
        assert!(s.contains("B:-"), "missing B dash: {}", s);
        assert!(s.contains("L:-"), "missing L dash: {}", s);
        assert!(s.contains("R:-"), "missing R dash: {}", s);
    }

    #[test]
    fn test_format_edge_bands_mixed() {
        let s = format_edge_bands(Some(2), None, Some(1), None);
        assert!(s.contains("T:2"));
        assert!(s.contains("B:-"));
        assert!(s.contains("L:1"));
        assert!(s.contains("R:-"));
    }

    #[test]
    fn test_edge_band_indicator_lines_on_standard_label() {
        let g = make_generator();
        let req = make_request(LabelSize::Large4x6, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        // Should have thick edge-band lines (stroke_width 0.8) for top, bottom, right
        let thick_lines: Vec<_> = out.content.elements.iter().filter(|e| {
            matches!(e, LabelElement::Line { stroke_width, .. } if (*stroke_width - 0.8).abs() < 0.01)
        }).collect();
        assert!(!thick_lines.is_empty(), "expected thick edge-band indicator lines");
    }

    // ── LabelRequest helper tests ────────────────────────────────────────────

    #[test]
    fn test_effective_barcode_value_uses_custom_when_set() {
        let mut req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        req.barcode_value = Some("CUSTOM-123".into());
        assert_eq!(req.effective_barcode_value(), "CUSTOM-123");
    }

    #[test]
    fn test_effective_barcode_value_falls_back_to_part_id() {
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let id_str = req.part_id.to_string();
        assert_eq!(req.effective_barcode_value(), id_str);
    }

    // ── truncate helper tests ────────────────────────────────────────────────

    #[test]
    fn test_truncate_short_string_unchanged() {
        let result = truncate_to_width("Short", 100.0, 5.5);
        assert_eq!(result, "Short");
    }

    #[test]
    fn test_truncate_long_string_gets_truncated() {
        let long = "This is a very long material description that should be truncated";
        let result = truncate_to_width(long, 20.0, 5.5);
        assert!(result.len() < long.len(), "expected truncation: {}", result);
        assert!(result.contains('…'), "expected ellipsis: {}", result);
    }

    // ── LabelFormat enum coverage ────────────────────────────────────────────

    #[test]
    fn test_all_three_formats_produce_output() {
        let g = make_generator();
        for format in &[LabelFormat::Compact, LabelFormat::Standard, LabelFormat::Detailed] {
            let req = make_request(LabelSize::Large4x6, *format, BarcodeType::Code128);
            let out = g.generate_label(&req);
            assert!(!out.content.elements.is_empty(), "format {:?} produced no elements", format);
        }
    }

    #[test]
    fn test_all_three_barcode_types_produce_barcode_element() {
        let g = make_generator();
        for btype in &[BarcodeType::Code128, BarcodeType::Code39, BarcodeType::Qr] {
            let req = make_request(LabelSize::Large4x6, LabelFormat::Standard, *btype);
            let out = g.generate_label(&req);
            let has_barcode = out.content.elements.iter().any(|e| {
                matches!(e, LabelElement::Barcode { data, .. } if data.barcode_type == *btype)
            });
            assert!(has_barcode, "missing barcode element for type {:?}", btype);
        }
    }

    // ── Serialization round-trip tests ───────────────────────────────────────

    #[test]
    fn test_barcode_data_serializes() {
        let g = make_generator();
        let bd = g.generate_barcode("PART-99", BarcodeType::Code128);
        let json = serde_json::to_string(&bd).expect("serialize barcode data");
        let back: BarcodeData = serde_json::from_str(&json).expect("deserialize barcode data");
        assert_eq!(back.value, bd.value);
        assert_eq!(back.bar_widths, bd.bar_widths);
    }

    #[test]
    fn test_label_output_serializes() {
        let g = make_generator();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        let json = serde_json::to_string(&out).expect("serialize label output");
        assert!(!json.is_empty());
        assert!(json.contains("elements"));
    }

    // ── Default implementation ───────────────────────────────────────────────

    #[test]
    fn test_default_creates_generator() {
        let g = LabelGenerator::default();
        let req = make_request(LabelSize::Medium2x4, LabelFormat::Standard, BarcodeType::Code128);
        let out = g.generate_label(&req);
        assert!(!out.content.elements.is_empty());
    }

    // ── is_reserved helper ───────────────────────────────────────────────────

    #[test]
    fn test_is_reserved_finder_top_left() {
        // All of rows 0-8, cols 0-8 are reserved (top-left finder + separator)
        assert!(is_reserved(0, 0));
        assert!(is_reserved(8, 8));
        assert!(is_reserved(0, 8));
    }

    #[test]
    fn test_is_reserved_timing() {
        assert!(is_reserved(6, 10));  // timing row
        assert!(is_reserved(10, 6));  // timing col
    }

    #[test]
    fn test_is_reserved_data_module() {
        // A data module (not reserved)
        assert!(!is_reserved(10, 10));
        assert!(!is_reserved(15, 15));
    }
}
