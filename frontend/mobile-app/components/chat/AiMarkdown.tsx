import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';

/**
 * AiMarkdown — Lightweight Markdown renderer for Bếp AI messages.
 * Renders: bold, italic, headings, ordered/unordered lists, links, line breaks.
 * No external dependencies needed.
 */

interface AiMarkdownProps {
  content: string;
}

// Parse inline formatting: **bold**, *italic*, [link](url)
const renderInline = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  // Match: **bold**, *italic*, [text](url), or plain text
  const inlineRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push plain text before match
    if (match.index > lastIndex) {
      nodes.push(
        <Text key={`${keyPrefix}-plain-${lastIndex}`}>{text.slice(lastIndex, match.index)}</Text>
      );
    }

    if (match[1]) {
      // **bold**
      nodes.push(
        <Text key={`${keyPrefix}-bold-${match.index}`} style={mdStyles.bold}>{match[2]}</Text>
      );
    } else if (match[3]) {
      // *italic*
      nodes.push(
        <Text key={`${keyPrefix}-italic-${match.index}`} style={mdStyles.italic}>{match[4]}</Text>
      );
    } else if (match[5]) {
      // [text](url)
      const linkText = match[6];
      const linkUrl = match[7];
      nodes.push(
        <Text
          key={`${keyPrefix}-link-${match.index}`}
          style={mdStyles.link}
          onPress={() => Linking.openURL(linkUrl)}
        >
          {linkText}
        </Text>
      );
    } else if (match[8]) {
      // Raw URL
      nodes.push(
        <Text
          key={`${keyPrefix}-rawlink-${match.index}`}
          style={mdStyles.link}
          onPress={() => Linking.openURL(match[8]!)}
        >
          {match[8]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    nodes.push(
      <Text key={`${keyPrefix}-tail-${lastIndex}`}>{text.slice(lastIndex)}</Text>
    );
  }

  if (nodes.length === 0) {
    nodes.push(<Text key={`${keyPrefix}-empty`}>{text}</Text>);
  }

  return nodes;
};

export default function AiMarkdown({ content }: AiMarkdownProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Empty line → spacer
    if (trimmed === '') {
      elements.push(<View key={`spacer-${i}`} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Heading: ### H3, ## H2, # H1
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? 18 : level === 2 ? 16 : 15;
      elements.push(
        <Text key={`h-${i}`} style={[mdStyles.heading, { fontSize }]}>
          {renderInline(headingMatch[2], `h-${i}`)}
        </Text>
      );
      i++;
      continue;
    }

    // Ordered list: 1. item, 2. item
    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      elements.push(
        <View key={`ol-${i}`} style={mdStyles.listItem}>
          <Text style={mdStyles.listBullet}>{olMatch[1]}.</Text>
          <Text style={mdStyles.listText}>{renderInline(olMatch[2], `ol-${i}`)}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Unordered list: - item, * item, • item
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      elements.push(
        <View key={`ul-${i}`} style={mdStyles.listItem}>
          <Text style={mdStyles.listBullet}>•</Text>
          <Text style={mdStyles.listText}>{renderInline(ulMatch[1], `ul-${i}`)}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <Text key={`p-${i}`} style={mdStyles.paragraph}>
        {renderInline(trimmed, `p-${i}`)}
      </Text>
    );
    i++;
  }

  return <View style={mdStyles.container}>{elements}</View>;
}

const mdStyles = StyleSheet.create({
  container: {
    gap: 2,
  },
  heading: {
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 6,
    marginBottom: 2,
    lineHeight: 24,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1a1a1a',
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  link: {
    color: '#1a73e8',
    textDecorationLine: 'underline',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginBottom: 2,
  },
  listBullet: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
    width: 20,
    fontWeight: '600',
  },
  listText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1a1a1a',
    flex: 1,
  },
});
