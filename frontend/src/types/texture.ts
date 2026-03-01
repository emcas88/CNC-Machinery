export enum Sheen {
  MATTE = 'matte',
  SATIN = 'satin',
  SEMI_GLOSS = 'semi_gloss',
  GLOSS = 'gloss',
  HIGH_GLOSS = 'high_gloss',
}

export enum GrainOrientation {
  NONE = 'none',
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
  DIAGONAL = 'diagonal',
}

export interface Texture {
  id: string
  name: string
  groupId?: string
  sheen: Sheen
  grainOrientation: GrainOrientation
  imageUrl?: string
  thumbnailUrl?: string
  color?: string
  tags: string[]
  createdAt: string
}

export interface TextureGroup {
  id: string
  name: string
  description?: string
  textureCount: number
  thumbnailUrl?: string
}

export interface CreateTexture {
  name: string
  groupId?: string
  sheen?: Sheen
  grainOrientation?: GrainOrientation
  color?: string
  tags?: string[]
}
