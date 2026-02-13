#!/usr/bin/env python3
import argparse
import json
import math
import re
from pathlib import Path

import pypdfium2 as pdfium

IMAGE_CROP_FALLBACK_AREA_RATIO = 0.62


def normalize_whitespace(value):
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def tokenize_for_score(value):
    text = normalize_whitespace(value).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return [token for token in text.split() if len(token) >= 3]


def clamp_bounds(bounds, page_width, page_height):
    x = max(0, int(math.floor(bounds["x"])))
    y = max(0, int(math.floor(bounds["y"])))
    max_x = min(page_width, int(math.ceil(bounds["x"] + bounds["width"])))
    max_y = min(page_height, int(math.ceil(bounds["y"] + bounds["height"])))
    return {
        "x": x,
        "y": y,
        "width": max(0, max_x - x),
        "height": max(0, max_y - y),
    }


def ensure_minimum_bounds_size(bounds, min_width, min_height, page_width, page_height):
    if not bounds:
        return clamp_bounds({"x": 0, "y": 0, "width": 0, "height": 0}, page_width, page_height)

    x = bounds["x"]
    y = bounds["y"]
    width = bounds["width"]
    height = bounds["height"]

    if width < min_width:
        grow_by = min_width - width
        x -= grow_by / 2
        width = min_width

    if height < min_height:
        grow_by = min_height - height
        y -= grow_by / 2
        height = min_height

    return clamp_bounds({"x": x, "y": y, "width": width, "height": height}, page_width, page_height)


def shrink_bounds_to_target_area_ratio(bounds, page_width, page_height, target_area_ratio):
    page_area = max(1, page_width * page_height)
    target_area = max(1, page_area * target_area_ratio)
    current_area = max(1, bounds["width"] * bounds["height"])
    if current_area <= target_area:
        return clamp_bounds(bounds, page_width, page_height)

    scale = math.sqrt(target_area / current_area)
    target_width = bounds["width"] * scale
    target_height = bounds["height"] * scale
    center_x = bounds["x"] + bounds["width"] / 2
    center_y = bounds["y"] + bounds["height"] / 2

    return clamp_bounds(
        {
            "x": center_x - target_width / 2,
            "y": center_y - target_height / 2,
            "width": target_width,
            "height": target_height,
        },
        page_width,
        page_height,
    )


def intersection_over_union(box_a, box_b):
    intersection_x = max(box_a["x"], box_b["x"])
    intersection_y = max(box_a["y"], box_b["y"])
    intersection_max_x = min(box_a["x"] + box_a["width"], box_b["x"] + box_b["width"])
    intersection_max_y = min(box_a["y"] + box_a["height"], box_b["y"] + box_b["height"])
    intersection_width = max(0, intersection_max_x - intersection_x)
    intersection_height = max(0, intersection_max_y - intersection_y)
    intersection_area = intersection_width * intersection_height
    if intersection_area <= 0:
        return 0

    area_a = box_a["width"] * box_a["height"]
    area_b = box_b["width"] * box_b["height"]
    union_area = area_a + area_b - intersection_area
    if union_area <= 0:
        return 0
    return intersection_area / union_area


def intersects_with_margin(text_bounds, crop_bounds, margin):
    crop_left = crop_bounds["x"] - margin
    crop_top = crop_bounds["y"] - margin
    crop_right = crop_bounds["x"] + crop_bounds["width"] + margin
    crop_bottom = crop_bounds["y"] + crop_bounds["height"] + margin

    text_left = text_bounds["x"]
    text_top = text_bounds["y"]
    text_right = text_bounds["x"] + text_bounds["width"]
    text_bottom = text_bounds["y"] + text_bounds["height"]

    return not (
        text_right < crop_left
        or text_left > crop_right
        or text_bottom < crop_top
        or text_top > crop_bottom
    )


def build_crop_context_text(text_lines, crop_bounds, margin, max_length):
    if not text_lines:
        return ""
    matched = [
        line["text"]
        for line in text_lines
        if intersects_with_margin(line, crop_bounds, margin)
    ]
    return normalize_whitespace(" ".join(matched))[:max_length]


def convert_pdf_bounds_to_pixels(left, bottom, right, top, page_height_points, scale_x, scale_y, image_w, image_h):
    x = left * scale_x
    y = (page_height_points - top) * scale_y
    width = (right - left) * scale_x
    height = (top - bottom) * scale_y
    return clamp_bounds(
        {"x": x, "y": y, "width": width, "height": height},
        image_w,
        image_h,
    )


def extract_char_items(text_page, page_height_points, scale_x, scale_y, image_w, image_h):
    char_count = text_page.count_chars()
    chars = []
    for char_index in range(char_count):
        char_text = text_page.get_text_range(char_index, 1)
        if not char_text:
            continue
        left, bottom, right, top = text_page.get_charbox(char_index)
        bounds = convert_pdf_bounds_to_pixels(
            left, bottom, right, top, page_height_points, scale_x, scale_y, image_w, image_h
        )
        if bounds["width"] <= 0 or bounds["height"] <= 0:
            continue
        chars.append(
            {
                "text": char_text,
                "x": bounds["x"],
                "y": bounds["y"],
                "width": bounds["width"],
                "height": bounds["height"],
            }
        )
    return chars


def build_text_lines(char_items):
    if not char_items:
        return []

    sorted_items = sorted(char_items, key=lambda item: (item["y"], item["x"]))
    heights = [item["height"] for item in sorted_items if item["height"] > 0]
    median_height = sorted(heights)[len(heights) // 2] if heights else 12
    line_gap = max(6, min(20, int(round(median_height * 0.9))))

    lines = []
    for item in sorted_items:
        center_y = item["y"] + item["height"] / 2
        matched_line = None
        closest_delta = None
        for line in lines:
            delta = abs(line["center_y"] - center_y)
            if delta <= line_gap and (closest_delta is None or delta < closest_delta):
                matched_line = line
                closest_delta = delta

        if matched_line is None:
            lines.append({"items": [item], "center_y": center_y})
            continue

        matched_line["items"].append(item)
        centers = [entry["y"] + entry["height"] / 2 for entry in matched_line["items"]]
        matched_line["center_y"] = sum(centers) / len(centers)

    normalized_lines = []
    for line in lines:
        items = sorted(line["items"], key=lambda entry: entry["x"])
        pieces = []
        min_x = math.inf
        min_y = math.inf
        max_x = -math.inf
        max_y = -math.inf
        previous = None

        for item in items:
            min_x = min(min_x, item["x"])
            min_y = min(min_y, item["y"])
            max_x = max(max_x, item["x"] + item["width"])
            max_y = max(max_y, item["y"] + item["height"])
            text = item["text"]
            if previous is not None:
                gap = item["x"] - (previous["x"] + previous["width"])
                space_threshold = max(1.5, min(previous["height"], item["height"]) * 0.35)
                if gap > space_threshold and previous["text"] != " " and text != " ":
                    pieces.append(" ")
            pieces.append(text)
            previous = item

        line_text = normalize_whitespace("".join(pieces))
        if not line_text:
            continue

        normalized_lines.append(
            {
                "text": line_text,
                "x": int(min_x),
                "y": int(min_y),
                "width": int(max_x - min_x),
                "height": int(max_y - min_y),
            }
        )

    return normalized_lines


def select_text_crop_candidates(
    text_lines,
    page_width,
    page_height,
    max_text_crops_per_page,
    text_block_padding_px,
    min_crop_edge_px,
    min_text_block_height_px,
    min_text_block_char_length,
    min_text_lines_per_block,
    max_text_lines_per_block,
    max_context_length,
):
    page_area = max(1, page_width * page_height)
    raw_candidates = []

    for start_index in range(len(text_lines)):
        combined_text = ""
        min_x = math.inf
        min_y = math.inf
        max_x = -math.inf
        max_y = -math.inf
        token_set = set()

        max_end = min(len(text_lines), start_index + max_text_lines_per_block)
        for end_index in range(start_index, max_end):
            line = text_lines[end_index]
            combined_text = normalize_whitespace(f"{combined_text} {line['text']}")
            token_set.update(tokenize_for_score(line["text"]))

            min_x = min(min_x, line["x"])
            min_y = min(min_y, line["y"])
            max_x = max(max_x, line["x"] + line["width"])
            max_y = max(max_y, line["y"] + line["height"])

            line_count = end_index - start_index + 1
            if line_count < min_text_lines_per_block or len(combined_text) < min_text_block_char_length:
                continue

            expanded = clamp_bounds(
                {
                    "x": min_x - text_block_padding_px,
                    "y": min_y - text_block_padding_px,
                    "width": (max_x - min_x) + text_block_padding_px * 2,
                    "height": (max_y - min_y) + text_block_padding_px * 2,
                },
                page_width,
                page_height,
            )

            area = expanded["width"] * expanded["height"]
            if (
                expanded["width"] < min_crop_edge_px
                or expanded["height"] < min_text_block_height_px
                or area < page_area * 0.004
                or area > page_area * 0.68
            ):
                continue

            score = len(token_set) * 2 + min(200, len(combined_text)) * 0.07
            raw_candidates.append(
                {
                    "bounds": expanded,
                    "contextText": combined_text[:max_context_length],
                    "score": score,
                }
            )

    raw_candidates.sort(key=lambda item: item["score"], reverse=True)

    selected = []
    for candidate in raw_candidates:
        overlaps_existing = any(
            intersection_over_union(existing["bounds"], candidate["bounds"]) > 0.72
            for existing in selected
        )
        if not overlaps_existing:
            selected.append(candidate)
        if len(selected) >= max_text_crops_per_page:
            break

    # Fallback: allow a single-line text crop when no multi-line blocks were found.
    if not selected and text_lines:
        best_line = max(text_lines, key=lambda line: len(line["text"]))
        expanded = ensure_minimum_bounds_size(
            clamp_bounds(
                {
                    "x": best_line["x"] - text_block_padding_px * 2,
                    "y": best_line["y"] - text_block_padding_px * 2,
                    "width": best_line["width"] + text_block_padding_px * 4,
                    "height": best_line["height"] + text_block_padding_px * 4,
                },
                page_width,
                page_height,
            ),
            min_crop_edge_px,
            max(56, int(min_text_block_height_px * 0.7)),
            page_width,
            page_height,
        )
        area = expanded["width"] * expanded["height"]
        if area >= page_area * 0.002:
            selected.append(
                {
                    "bounds": expanded,
                    "contextText": normalize_whitespace(best_line["text"])[:max_context_length],
                    "score": max(1, len(best_line["text"]) * 0.2),
                }
            )

    return selected


def select_image_crop_boxes(raw_bounds, page_width, page_height, min_crop_edge_px, min_crop_area_ratio, max_crop_area_ratio, max_crops_per_page):
    page_area = max(1, page_width * page_height)
    normalized = []
    filtered = []
    for bounds in raw_bounds:
        clamped = clamp_bounds(bounds, page_width, page_height)
        normalized.append(clamped)
        width = clamped["width"]
        height = clamped["height"]
        if width < min_crop_edge_px or height < min_crop_edge_px:
            continue
        area = width * height
        if area < page_area * min_crop_area_ratio:
            continue
        if area > page_area * max_crop_area_ratio:
            continue
        aspect_ratio = width / max(1, height)
        if aspect_ratio <= 0.15 or aspect_ratio >= 6.5:
            continue
        filtered.append(clamped)

    filtered.sort(key=lambda entry: entry["width"] * entry["height"], reverse=True)

    selected = []
    for bounds in filtered:
        overlaps_existing = any(intersection_over_union(existing, bounds) > 0.85 for existing in selected)
        if not overlaps_existing:
            selected.append(bounds)
        if len(selected) >= max_crops_per_page:
            break

    # Fallback: for scan-like PDFs where the only image object is near-full-page.
    if not selected and normalized:
        normalized.sort(key=lambda entry: entry["width"] * entry["height"], reverse=True)
        fallback = normalized[0]
        fallback_area = fallback["width"] * fallback["height"]

        if fallback_area > page_area * max_crop_area_ratio:
            fallback = shrink_bounds_to_target_area_ratio(
                fallback,
                page_width,
                page_height,
                IMAGE_CROP_FALLBACK_AREA_RATIO,
            )

        fallback = ensure_minimum_bounds_size(
            fallback,
            min_crop_edge_px,
            min_crop_edge_px,
            page_width,
            page_height,
        )
        fallback_area = fallback["width"] * fallback["height"]
        if fallback_area >= page_area * min_crop_area_ratio:
            selected.append(fallback)

    return selected


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--max-pages", type=int, default=20)
    parser.add_argument("--max-total-crops", type=int, default=36)
    parser.add_argument("--max-image-crops-per-page", type=int, default=4)
    parser.add_argument("--max-text-crops-per-page", type=int, default=6)
    parser.add_argument("--max-render-dimension", type=int, default=2400)
    parser.add_argument("--base-render-scale", type=float, default=2.4)
    parser.add_argument("--min-crop-edge-px", type=int, default=120)
    parser.add_argument("--min-crop-area-ratio", type=float, default=0.008)
    parser.add_argument("--max-crop-area-ratio", type=float, default=0.72)
    parser.add_argument("--crop-context-margin-px", type=int, default=100)
    parser.add_argument("--max-context-length", type=int, default=320)
    parser.add_argument("--max-page-text-length", type=int, default=2600)
    parser.add_argument("--text-block-padding-px", type=int, default=28)
    parser.add_argument("--min-text-block-height-px", type=int, default=80)
    parser.add_argument("--min-text-block-char-length", type=int, default=28)
    parser.add_argument("--min-text-lines-per-block", type=int, default=2)
    parser.add_argument("--max-text-lines-per-block", type=int, default=6)
    return parser.parse_args()


def main():
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pdf = pdfium.PdfDocument(str(input_path))
    pages_to_render = min(len(pdf), max(1, args.max_pages))
    page_image_files = []
    image_candidates = []
    total_crop_count = 0

    for page_number in range(1, pages_to_render + 1):
        page = pdf[page_number - 1]
        page_width_points = float(page.get_width())
        page_height_points = float(page.get_height())

        largest_dimension_points = max(page_width_points, page_height_points, 1.0)
        scale_from_dimension = args.max_render_dimension / largest_dimension_points
        render_scale = min(args.base_render_scale, scale_from_dimension) if args.max_render_dimension > 0 else args.base_render_scale
        render_scale = max(1.0, render_scale)

        pil_image = page.render(scale=render_scale).to_pil()
        page_width_px, page_height_px = pil_image.size
        scale_x = page_width_px / max(1.0, page_width_points)
        scale_y = page_height_px / max(1.0, page_height_points)

        page_file_name = f"page-{page_number}.png"
        page_output_path = output_dir / page_file_name
        pil_image.save(page_output_path, format="PNG")
        page_image_files.append({"pageNumber": page_number, "fileName": page_file_name})

        if total_crop_count >= args.max_total_crops:
            continue

        text_page = page.get_textpage()
        page_text = normalize_whitespace(text_page.get_text_bounded())[: args.max_page_text_length]

        char_items = extract_char_items(
            text_page,
            page_height_points,
            scale_x,
            scale_y,
            page_width_px,
            page_height_px,
        )
        text_lines = build_text_lines(char_items)

        raw_image_bounds = []
        for obj in page.get_objects():
            if type(obj).__name__ != "PdfImage":
                continue
            left, bottom, right, top = obj.get_bounds()
            raw_image_bounds.append(
                convert_pdf_bounds_to_pixels(
                    left,
                    bottom,
                    right,
                    top,
                    page_height_points,
                    scale_x,
                    scale_y,
                    page_width_px,
                    page_height_px,
                )
            )

        crop_bounds = select_image_crop_boxes(
            raw_image_bounds,
            page_width_px,
            page_height_px,
            args.min_crop_edge_px,
            args.min_crop_area_ratio,
            args.max_crop_area_ratio,
            args.max_image_crops_per_page,
        )
        text_crop_candidates = select_text_crop_candidates(
            text_lines,
            page_width_px,
            page_height_px,
            args.max_text_crops_per_page,
            args.text_block_padding_px,
            args.min_crop_edge_px,
            args.min_text_block_height_px,
            args.min_text_block_char_length,
            args.min_text_lines_per_block,
            args.max_text_lines_per_block,
            args.max_context_length,
        )

        crop_sequence = 1
        for bounds in crop_bounds:
            if total_crop_count >= args.max_total_crops:
                break
            crop_file_name = f"page-{page_number}-crop-{crop_sequence}.png"
            crop_output_path = output_dir / crop_file_name
            cropped = pil_image.crop(
                (
                    bounds["x"],
                    bounds["y"],
                    bounds["x"] + bounds["width"],
                    bounds["y"] + bounds["height"],
                )
            )
            cropped.save(crop_output_path, format="PNG")

            image_candidates.append(
                {
                    "pageNumber": page_number,
                    "fileName": crop_file_name,
                    "sourceType": "image-object",
                    "width": bounds["width"],
                    "height": bounds["height"],
                    "area": bounds["width"] * bounds["height"],
                    "areaRatio": (bounds["width"] * bounds["height"]) / max(1, page_width_px * page_height_px),
                    "contextText": build_crop_context_text(
                        text_lines, bounds, args.crop_context_margin_px, args.max_context_length
                    ),
                    "pageText": page_text,
                }
            )
            crop_sequence += 1
            total_crop_count += 1

        for candidate in text_crop_candidates:
            if total_crop_count >= args.max_total_crops:
                break
            bounds = candidate["bounds"]
            crop_file_name = f"page-{page_number}-crop-{crop_sequence}.png"
            crop_output_path = output_dir / crop_file_name
            cropped = pil_image.crop(
                (
                    bounds["x"],
                    bounds["y"],
                    bounds["x"] + bounds["width"],
                    bounds["y"] + bounds["height"],
                )
            )
            cropped.save(crop_output_path, format="PNG")

            image_candidates.append(
                {
                    "pageNumber": page_number,
                    "fileName": crop_file_name,
                    "sourceType": "text-block",
                    "width": bounds["width"],
                    "height": bounds["height"],
                    "area": bounds["width"] * bounds["height"],
                    "areaRatio": (bounds["width"] * bounds["height"]) / max(1, page_width_px * page_height_px),
                    "contextText": candidate["contextText"],
                    "pageText": page_text,
                }
            )
            crop_sequence += 1
            total_crop_count += 1

    print(json.dumps({"pageImageFiles": page_image_files, "imageCandidates": image_candidates}))


if __name__ == "__main__":
    main()
