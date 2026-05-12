/**
 * Home screen — placeholder for the bootstrap sprint.
 *
 * Activated in the next implementation sprint, when Expo + React Native deps
 * are accepted via ADR (`AGENTS.md` §4.11) and added to `package.json`.
 *
 * Until then this file is excluded from the typecheck and renderer paths
 * (see `mobile/tsconfig.json` `exclude`). It exists to lock in file ownership
 * and to give `add-screen.md` a real call site to reference.
 */

import React from "react";
import { Text, View } from "react-native";

import { t } from "../lib/i18n";

export default function HomeScreen(): React.JSX.Element {
  return (
    <View>
      <Text>{t("home.title")}</Text>
      <Text>{t("home.empty")}</Text>
    </View>
  );
}
