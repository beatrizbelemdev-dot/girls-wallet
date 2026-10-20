import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { CreditCard } from 'lucide-react-native';
import { colors } from '../theme';

// SVGs já baixados (ou `null` quando falharam), para não repetir a consulta a cada exibição.
const svgCache = new Map<string, string | null>();

/** A BrasilAPI devolve logos em SVG e também em PNG/JPG; só o SVG precisa de tratamento especial. */
function isRaster(uri: string): boolean {
  return /\.(png|jpe?g|webp)(\?|$)/i.test(uri);
}

/**
 * Baixa um SVG como texto. Pede o arquivo sem compressão (o CDN responde em Brotli, que nem
 * sempre é descomprimido pelo app) e só aceita o resultado se for mesmo um SVG.
 *
 * @returns O texto do SVG, ou `null` se a rede falhar ou o conteúdo não for SVG.
 */
async function loadSvg(uri: string): Promise<string | null> {
  if (svgCache.has(uri)) return svgCache.get(uri) ?? null;
  let xml: string | null = null;
  try {
    const response = await fetch(uri, { headers: { 'Accept-Encoding': 'identity' } });
    if (response.ok) {
      const text = await response.text();
      xml = text.trimStart().startsWith('<') && text.includes('<svg') ? text : null;
    }
  } catch {
    xml = null;
  }
  svgCache.set(uri, xml);
  return xml;
}

/**
 * Logo de um banco. Mostra o ícone de cartão quando não há endereço de logo ou quando ela não
 * carrega (sem internet, arquivo inválido ou erro no SVG), então a tela nunca fica quebrada.
 * Aceita SVG (via `SvgXml`) e PNG/JPG (via `Image`).
 *
 * @param uri Endereço da logo (`logoUrl` do cartão); opcional.
 * @param size Largura e altura, em pontos. Padrão: 36.
 */
export function BankLogo({ uri, size = 36 }: { uri?: string; size?: number }) {
  const raster = uri ? isRaster(uri) : false;
  const [failed, setFailed] = useState(false);
  const [xml, setXml] = useState<string | null | undefined>(uri && !raster ? svgCache.get(uri) : undefined);

  useEffect(() => {
    if (!uri || raster || xml !== undefined) return;
    let active = true;
    void loadSvg(uri).then((loaded) => {
      if (active) setXml(loaded);
    });
    return () => {
      active = false;
    };
  }, [uri, raster, xml]);

  const inner = size * 0.8;
  const fallback = <CreditCard size={Math.round(size * 0.6)} color={colors.primary} />;
  let content = fallback;
  if (uri && raster && !failed) {
    content = <Image source={{ uri }} style={{ width: inner, height: inner }} resizeMode="contain" onError={() => setFailed(true)} />;
  } else if (uri && !raster && xml) {
    content = <SvgXml xml={xml} width={inner} height={inner} />;
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: colors.roseLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {content}
    </View>
  );
}
