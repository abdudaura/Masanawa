import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../agents/agent_directory.dart';
import '../../theme/masanawa_theme.dart';

const _gwani = 'UklGRkoHAABXRUJQVlA4WAoAAAAQAAAALwAALwAAQUxQSDUCAAABoLNtmyHbXtBb2Di2kdkOz4ls2/mJbNu2zci2T2TbNqa63ne+oLurq1dETAAqOh9nhxPuibNmBY8Z6CPaP9hxAOCiGysAbuU9znz0n6zT999kWQBuJKx79pvJzKaSmf356lGLwo3hZ11As2mTGkkpZTP7YCnn6kXsajllqp/5f9sGYYzDONHARiMdYWmQbTXO8TPujBpbj3Nhja3GubLGNuPcMsMC7rdm2I5jeDxWYyfEEWY/PYjKG8JXi9g/Nxqap8+ifsTZlobZV7Ph6p00rfFWdKi3tw1LdidCNY+1mIdND0WsBodXrBlA2RrwI4QVz1BTRKW9ncOIAWsYi7J9BIzi/DyfWS5Jdr2PGDXiJEsF5D/rwI+1T1FjD8Bj3NlxR2sKkt0c5rh6zkcH7DrgXgA++iohAMC6Z38vFoiTh/dbBoAPboALAGZteOTzNJNYIrPfHj5kfQDBF7gAYNNrPpQZE0mVsklmZvdutiQQXJcH5jv4dTPLk4YkRRaIzCnR7OcrVwICABcx57BPzNKkyZREST3slMRJMvv7koURggNWf8MsNZmdItVPqUUp55xk72wMYO4OP9n/DUmKlMpUQFL835qHd1/wQ7PEXnWzTCLFnEkmmn1hTWZbJRLZIjvame08SdawU1IJSXawjyTFnNmwUxRJ9ohqD+pVF6mSblIDxJxZWkEU1dsqFFW5ilokJZFjSewVyRYHFTN3iBTFFmuQLCDVJqWWpCoq7CBFiZTIOuV9AFZQOCCmAgAA8A0AnQEqMAAwAD7BUqBLp6SjIaq6rVDwGAlsAMAftIPg4jNI3voFPMB52WmZ7yb/jKBfzN2RyqeD/GR375lfQSRMsWrbr83U5Lt3CFF4UTrnd7l78/C+DHpnwm9BqDtSWzVwFfGZqtQ1uq+fhqq3EoN5GSq5t3kAAP7+9l17TE8cMubRXq7CgUKyL8TqMndd4UfukO5Y7nW/+6B1fXUNZll3VdSxAjC+LhpQ/sY6o/gGCLNep1DqTGroY7Uzln3hYKvBWQSbAGMbywNoI3wSan1Ygl/o2llvvKqfUZIlD/73lf3c0em+2WTPsJTwnNShYkK3ZSuqtdYPZtIhBuQecICzYjX61cGGUi/Z9/wpdy55SYPmyRe8tMIfDcnbCm/GuMbKlRMbkz77wJSelGrsffv0tG0FRes773QtUgxSUEtvIRMm+BgZGkjhh7v9gpMMIxTKQXeC62pd3bC8WfDxys9jX6LLqXE6T++eBWFGNwyDuUdY/QtP5jzRiYq5TicC5UomCmcrjgKWXpNSuP63hB/W6Eh7cU8pcnekqAPJ4Lf16ftFR+ugqtsm+kV/Ia4LL6HwveNkSJVGT1OOtVi1Fx22NOCXkC5HKLXZax2/NXMu+09+0L23dWIpjAfI/XR8EyylAf2kNXOAJcVJh/Lc/Gh+5GsHuBIEXlVPo4fjQrseFN3Lg9tO36JV/c/eoSemw11D/ShU4g03EOc8GR1SqE9Kzq26dpl8z5vpUPI3Kl653Jzv8VRpvTnA2I8CrMuwVDGZvqYvob/KVQJLdLfddmeMhbBtPJxa7GSG/CxqywNFgHlznyv3a0dtKJuXE8ynAobWv++sJnejZlYIy5bH71xzSmqzEImzDh/0S5bALA7MUBDHtPmciF5sbxEEafcgkh8WvuAA';
const _gwana = 'UklGRoIGAABXRUJQVlA4WAoAAAAQAAAALwAALwAAQUxQSLECAAABoLRtmyHJlv9mRM4c27Zt2/bZ2Wdn27btpW1rZ9s2M+J73/oWFYmOiAlA7xCBBc5+6rVnbjtuLSAETHQE5jn0ey/aI5sAcYIiFr/lD/ecs+Us98dXQZyQiD3+cM8UJZHZPO2OegIiTvNRoiRxTErStoiDRRzsydSRlLL+WAJhoIBlmky1U8Xkb08TqoHqlzxrwMZvQBykxiGe1JeSmHwjxCECXhnlXhKl5C8gDBCwyH/iAJJIrYjQr8ZRnjRQ4yeh7hfwjOehkj+M0KvCTL84W9hD2T+qUfWJWMPZNs4ONP9u+n419vKknuzy7bRDXOxNn3Zmfy/0C3jccxeKbWQa3Y2InhXCe57ZoTOVfG/U/ab71o0S+5HZf5ihqvpN/0MvFkgmHYSI3lV40zOpVraJ5t9OVVX9alziDckWiSUyj76ZHgMELGOZItva2fgRiBgw4hZvRFIco1hK/v7kUA0RwmzfjNJYkSzQqPURMWjEeskzSVHtZNKJmFQNg4htfpORbCOZ/CkAiMOESZj9KxlJliSS/z+w0wJTIoR+VQS2vOV/Fkscl/s/H+0D1FWPAKzysLtKJCWOiynJ/a5FgNilqlGfmjwnkhQ1xnbLOfnf582E0BaBVV52SxxSzCSZ5J/vhdCCOc9pvDGSlHqJJCVr3E9DBFCF+rSfXYntkrpQKpD5f98PEQi4xtkYSUokJbEsiaTEorI+jaEKWNRytkJRJEWJEltFkWLy8xBrnOUNzYwqkaJIiR1FijTLvhmqKT4dZRaNlMTWThQpUo0/VmFbTywa2zXW3VjM/hJwtzelISV1MZL6a+kF/xrZMCqSpCS2JL/iWE8sqocksSx2MP38+igXRFLWIvY3mpGkjFYompW6WkvRzDKtkzikFWyMVuxSNhppLVYqG2ksWg926W5mBABWUDggqgMAAHAPAJ0BKjAAMAA+qUKXSqYjoiG1TVDAFQlsALEfKhLF+uA3tlueA0yLeV/249GCsI8cYNDJpkC740wbhD8BpAaQKdX/uPG59bewSx1P5ABpSrtucwxaXhuSXLvknxsQwfuyCWNonx+5kpUubMqQy2Secy/+uVZTR/4vAbxV1ikfj63eAAD+/xrdzOvacg1TX5KzXBn8HdJw4utalveUTNowcsPkvzvC1ZQC+PtMI7sXkus4RSolgUiAm1dMGPz7kwjU2hrj5wutJOsZ9Qm52P9Pm8f9OrFhj6VSMJojY26fXmGZnUIytjzkrqJFqDUWf5D+FD05ooXE27xyg0ILN+Gs9ZoboZKN2qmGSrCSzzfYzwmX+AQB14404RfFCOv1LKytcDOcLhTGcc35zxBQ0Gr8yqhL40GizHHc+RlJFbaSP3v8PSOH/5Qhr7rTV6QyMSx4LE/Wk9wdP3Arc+MD420pBRQ+Txa/P+RI6xWb7L8Yj48r2/9u6fdHGYor/cnYT+CO20SzNLAdatYz4TrPraYm5UU8P7j+3S7LrnivqfLmzfwRY71Ve+R3ZUyJAX3wyKwtAr3g8WvfonbNE9NpP5Uln5Gk9/g/NQDfJtM5ZuumYmaT/KK8/43LETRAeYV75vcTaKeh5ZXvWbima6xwFVTwjcJ3Fub782yw+s0DxaJQDXEQXY4eKZBYwcwWYrAKr/yL19KI2ukjbapaKSUPGiy6aMyUWNG+e4jufELm20PyRvcXsjtmzItBIln0xnur+aCdcbnBInR9zmBSK3CXYBcelAfhTC25MdiXxBGN7ndbCVX8+3vzMHxzU3KC4mhAkMQ292+8LnutitWTWxCrtAWVj/vJ5CtUHPvMAvsD9qduXp8KfvsB1KJsccfL0p1PPmNNfpxmtdsKv3PgykQyWhI1MPW9X8pQCgosa75Gzc88XoQXmOtbSqBePtCtYMLKq4cN7YFOAtMtGYk3LFOYoJYjID7sYdoKldG2l8qzGRSHRa9BY6SL80EaIY2WEGWtskHBbAY7sdKKUata0rxskuFp5UR4Gbk9MH2NOheheiAbPqduRlWkQ9HKXL9m8Cnr9CNn1r5Us4cE1KX7c1CO0L8ZMZnvFLRRWIelGnsjyIwr/MNColp7XYd0e07TK13zt3UEtrT7KivwHOcs6qHG0DOGLF6L7QmmYHz+NB/JbOPK2MsIaTrfGTcqcPz9i7OzmEBLk5HOlee3hoAIKqUcwnTyAudpyTBMDgAA';

Uint8List? bundledPlatformAgentPortrait(String displayName) {
  final key = displayName.trim().toLowerCase();
  if (key == 'gwani') return base64Decode(_gwani);
  if (key == 'gwana') return base64Decode(_gwana);
  return null;
}

class PlatformAgentAvatar extends StatelessWidget {
  const PlatformAgentAvatar({
    super.key,
    required this.agent,
    this.radius = 22,
    this.showPresence = false,
  });

  final AgentDirectoryEntry agent;
  final double radius;
  final bool showPresence;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final remote = agent.avatarUrl?.trim();
    final bundled = bundledPlatformAgentPortrait(agent.displayName);
    final image = remote != null && remote.isNotEmpty
        ? NetworkImage(remote) as ImageProvider
        : bundled == null
            ? null
            : MemoryImage(bundled);
    final avatar = CircleAvatar(
      radius: radius,
      backgroundColor: u.brand.withValues(alpha: .10),
      foregroundImage: image,
      child: image == null
          ? Text(
              agent.initial,
              style: TextStyle(
                color: u.brand,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    );
    if (!showPresence) return avatar;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        avatar,
        Positioned(
          right: -1,
          bottom: -1,
          child: Container(
            width: radius * .48,
            height: radius * .48,
            decoration: BoxDecoration(
              color: agent.presence == AgentPresence.offline ? u.textMuted : u.success,
              shape: BoxShape.circle,
              border: Border.all(color: u.surfaceBg, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
