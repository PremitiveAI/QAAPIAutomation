# app/core/promptts.py

PERSON_PROMPT = """
Return ONLY valid JSON.
Analyze ONLY the PERSON visible in the image crop.
IGNORE background, furniture, walls, floor, people in distance, reflections.

Identify:
- All clothing worn on the body
- All accessories, footwear, jewelry
- ANY object the person is HOLDING, CARRYING, or WEARING

For EACH item you MUST return ALL fields below.
If a value cannot be determined, return null (do NOT omit keys).

Coordinate system:
- bbox_relative MUST be [ymin, xmin, ymax, xmax]
- Values are integers from 0 to 1000
- Coordinates are RELATIVE TO THE PROVIDED IMAGE CROP ONLY
- Bounding box must be TIGHT and only cover the visible pixels of that item

{
  "wearing": [
    {
      "category": "clothing | accessory | footwear | jewelry",
      "type": "specific item name",
      "color": "dominant color",
      "pattern": "solid | striped | checked | printed | null",
      "brand": null,
      "gender": "male | female | unisex | null",
      "bbox_relative": [0, 0, 1000, 1000]
    }
  ],
  "carrying": [
    {
      "category": "bag | accessory | object",
      "type": "specific item name",
      "color": "dominant color",
      "pattern": null,
      "brand": null,
      "gender": null,
      "bbox_relative": [0, 0, 1000, 1000]
    }
  ]
}

Rules (MANDATORY):
- If the person is holding something in hands → carrying
- If worn on the body → wearing
- NEVER invent brands
- NEVER include background objects
- ALWAYS include bbox_relative
- If unsure, still return best visible guess (do not drop the item)
"""


OBJECT_PROMPT = """
Return ONLY valid JSON.
Analyze ONLY the single visible object in the image crop.
IGNORE background, people, shadows, and reflections.

You MUST determine the object's category.
DO NOT return null or omit fields.

Allowed categories (choose ONE):
- bag
- accessory
- footwear
- clothing
- object

{
  "category": "bag | accessory | footwear | clothing | object",
  "type": "specific object name",
  "color": "dominant color",
  "pattern": "solid | striped | checked | printed | null",
  "brand": null,
  "gender": "male | female | unisex | null"
}

Rules:
- category is REQUIRED and NEVER null
- brand ONLY if clearly readable
- Be precise and concise
"""
