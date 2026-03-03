// F24 – ShopCutlistApp: Real API-driven shop cutlist with sort, filter,
// group-by-material, mark-as-cut, grain direction display, and print.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CutlistPart {
  id: string;
  name: string;
  length: number;
  width: number;
  thickness: number;
  material: string;
  grainDirection: 'length' | 'width' | 'none';
  quantity: number;
  isCut: boolean;
  edgeBanding?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  notes?: string;
  jobId: string;
  productName?: string;
}

export interface CutlistResponse {
  jobId: string;
  jobName: string;
  parts: CutlistPart[];
  totalParts: number;
  cutParts: number;
}

export type SortField = 'name' | 'material' | 'length' | 'width' | 'thickness';
export type SortDirection = 'asc' | 'desc';