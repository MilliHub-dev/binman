import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, Text } from '../../components';
import { spacing, useStyles, type Colors } from '../../theme';

/**
 * Renders a legal document.
 *
 * Terms and the privacy policy used to be `Linking.openURL` calls to
 * binman.ng/terms and /privacy — a domain that does not resolve, so both links
 * did nothing at all. Shipping the text inside the app means it is available
 * offline, on a device with no browser configured, and cannot rot when a
 * marketing site is rebuilt.
 *
 * Both documents share this component so they stay typographically identical;
 * only the content differs.
 */

export interface LegalSection {
  heading: string;
  /** Paragraphs. */
  body?: string[];
  bullets?: string[];
}

interface Props {
  title: string;
  /** ISO date the document last changed — customers are entitled to know. */
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export const LegalDocument: React.FC<Props> = ({ title, lastUpdated, intro, sections }) => {
  const styles = useStyles(makeStyles);

  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="h1">{title}</Text>
        <Text variant="caption" tone="muted" style={styles.updated}>
          Last updated {new Date(lastUpdated).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>

        <Text tone="secondary" style={styles.intro}>
          {intro}
        </Text>

        {sections.map((section, index) => (
          <View key={section.heading} style={styles.section}>
            <Text variant="h3" style={styles.heading}>
              {index + 1}. {section.heading}
            </Text>

            {section.body?.map((paragraph) => (
              <Text key={paragraph} tone="secondary" style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}

            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text tone="muted" style={styles.bulletDot}>
                  •
                </Text>
                <Text tone="secondary" style={styles.bulletText}>
                  {bullet}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.bottomSpace} />
      </View>
    </Screen>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    body: { flexGrow: 1, paddingTop: spacing.md },
    updated: { marginTop: spacing.xs },
    intro: { marginTop: spacing.lg },
    section: { marginTop: spacing.xl },
    heading: { marginBottom: spacing.sm },
    paragraph: { marginBottom: spacing.md, lineHeight: 22 },
    bulletRow: { flexDirection: 'row', marginBottom: spacing.sm, paddingRight: spacing.sm },
    bulletDot: { width: 16, lineHeight: 22 },
    bulletText: { flex: 1, lineHeight: 22, color: c.textSecondary },
    bottomSpace: { height: spacing.xxl },
  });
