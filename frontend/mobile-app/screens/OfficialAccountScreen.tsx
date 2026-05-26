import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────
interface OfficialAccount {
  id: string;
  name: string;
  avatar: string;
  coverImage: string;
  category: string;
  followers: number;
  description: string;
  isFollowed: boolean;
  isVerified: boolean;
}

interface OACategory {
  id: string;
  name: string;
  icon: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const OA_CATEGORIES: OACategory[] = [
  { id: "all", name: "Tất cả", icon: "grid-outline" },
  { id: "bank", name: "Ngân hàng", icon: "card-outline" },
  { id: "food", name: "Ẩm thực", icon: "restaurant-outline" },
  { id: "shop", name: "Mua sắm", icon: "bag-handle-outline" },
  { id: "edu", name: "Giáo dục", icon: "school-outline" },
  { id: "health", name: "Sức khỏe", icon: "fitness-outline" },
  { id: "tech", name: "Công nghệ", icon: "hardware-chip-outline" },
  { id: "travel", name: "Du lịch", icon: "airplane-outline" },
];

const SUGGESTED_OAS: OfficialAccount[] = [
  {
    id: "oa1",
    name: "Vietcombank",
    avatar: "https://picsum.photos/seed/vcb/200/200",
    coverImage: "https://picsum.photos/seed/vcb_cover/600/200",
    category: "bank",
    followers: 5200000,
    description: "Ngân hàng TMCP Ngoại thương Việt Nam - Dịch vụ tài chính hàng đầu",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa2",
    name: "Shopee Việt Nam",
    avatar: "https://picsum.photos/seed/shopee/200/200",
    coverImage: "https://picsum.photos/seed/shopee_cover/600/200",
    category: "shop",
    followers: 8900000,
    description: "Nền tảng mua sắm trực tuyến hàng đầu Đông Nam Á 🛒",
    isFollowed: true,
    isVerified: true,
  },
  {
    id: "oa3",
    name: "The Coffee House",
    avatar: "https://picsum.photos/seed/tch/200/200",
    coverImage: "https://picsum.photos/seed/tch_cover/600/200",
    category: "food",
    followers: 1500000,
    description: "Nhà có gì? Có cà phê ☕ Chuỗi cà phê hàng đầu Việt Nam",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa4",
    name: "Samsung Việt Nam",
    avatar: "https://picsum.photos/seed/samsung/200/200",
    coverImage: "https://picsum.photos/seed/samsung_cover/600/200",
    category: "tech",
    followers: 3200000,
    description: "Samsung Electronics - Công nghệ cho cuộc sống tốt đẹp hơn",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa5",
    name: "VnExpress",
    avatar: "https://picsum.photos/seed/vnexpress/200/200",
    coverImage: "https://picsum.photos/seed/vnex_cover/600/200",
    category: "edu",
    followers: 12000000,
    description: "Báo tiếng Việt nhiều người đọc nhất 📰",
    isFollowed: true,
    isVerified: true,
  },
];

const ALL_OAS: OfficialAccount[] = [
  {
    id: "oa6",
    name: "Grab Việt Nam",
    avatar: "https://picsum.photos/seed/grab/200/200",
    coverImage: "https://picsum.photos/seed/grab_cover/600/200",
    category: "tech",
    followers: 6700000,
    description: "Siêu ứng dụng - Gọi xe, giao đồ ăn, thanh toán và nhiều hơn nữa",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa7",
    name: "Highlands Coffee",
    avatar: "https://picsum.photos/seed/highlands/200/200",
    coverImage: "https://picsum.photos/seed/highlands_cover/600/200",
    category: "food",
    followers: 980000,
    description: "Cà phê Việt Nam - Mang đến hương vị tuyệt vời mỗi ngày ☕",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa8",
    name: "Tiki",
    avatar: "https://picsum.photos/seed/tiki/200/200",
    coverImage: "https://picsum.photos/seed/tiki_cover/600/200",
    category: "shop",
    followers: 4500000,
    description: "Tiki - Mua hàng chất lượng, giao hàng siêu tốc TikiNOW 🚀",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa9",
    name: "Vietnam Airlines",
    avatar: "https://picsum.photos/seed/vna/200/200",
    coverImage: "https://picsum.photos/seed/vna_cover/600/200",
    category: "travel",
    followers: 2100000,
    description: "Hãng hàng không quốc gia Việt Nam ✈️",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa10",
    name: "Bệnh viện Bạch Mai",
    avatar: "https://picsum.photos/seed/bachmai/200/200",
    coverImage: "https://picsum.photos/seed/bachmai_cover/600/200",
    category: "health",
    followers: 750000,
    description: "Bệnh viện đa khoa hạng đặc biệt tuyến Trung ương 🏥",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa11",
    name: "Techcombank",
    avatar: "https://picsum.photos/seed/techcom/200/200",
    coverImage: "https://picsum.photos/seed/techcom_cover/600/200",
    category: "bank",
    followers: 3800000,
    description: "Ngân hàng Kỹ Thương Việt Nam - Vượt trội hơn mỗi ngày",
    isFollowed: false,
    isVerified: true,
  },
  {
    id: "oa12",
    name: "FPT Education",
    avatar: "https://picsum.photos/seed/fpted/200/200",
    coverImage: "https://picsum.photos/seed/fpted_cover/600/200",
    category: "edu",
    followers: 1200000,
    description: "Tổ chức giáo dục FPT - Đào tạo nhân tài công nghệ 🎓",
    isFollowed: false,
    isVerified: false,
  },
];

// ─── Helpers ─────────────────────────────────────────────────
const formatFollowers = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return num.toString();
};

// ─── Suggested OA Card (horizontal) ─────────────────────────
const SuggestedCard = React.memo(
  ({
    item,
    onToggleFollow,
  }: {
    item: OfficialAccount;
    onToggleFollow: (id: string) => void;
  }) => (
    <TouchableOpacity style={styles.suggestedCard} activeOpacity={0.8}>
      <Image source={{ uri: item.coverImage }} style={styles.suggestedCover} />
      <View style={styles.suggestedBody}>
        <View style={styles.suggestedAvatarWrap}>
          <Image source={{ uri: item.avatar }} style={styles.suggestedAvatar} />
          {item.isVerified && (
            <View style={styles.verifiedBadgeSmall}>
              <Ionicons name="checkmark-circle" size={16} color="#0068FF" />
            </View>
          )}
        </View>
        <Text style={styles.suggestedName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.suggestedFollowers}>
          {formatFollowers(item.followers)} người theo dõi
        </Text>
        <TouchableOpacity
          style={[
            styles.followBtn,
            item.isFollowed && styles.followBtnFollowed,
          ]}
          onPress={() => onToggleFollow(item.id)}
        >
          {item.isFollowed ? (
            <Text style={styles.followBtnTextFollowed}>Đang theo dõi</Text>
          ) : (
            <>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.followBtnText}>Theo dõi</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
);

// ─── OA List Item (vertical) ────────────────────────────────
const OAListItem = React.memo(
  ({
    item,
    onToggleFollow,
  }: {
    item: OfficialAccount;
    onToggleFollow: (id: string) => void;
  }) => (
    <TouchableOpacity style={styles.oaListItem} activeOpacity={0.7}>
      <View style={styles.oaAvatarWrap}>
        <Image source={{ uri: item.avatar }} style={styles.oaAvatar} />
        {item.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#0068FF" />
          </View>
        )}
      </View>
      <View style={styles.oaInfo}>
        <Text style={styles.oaName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.oaDesc} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.oaFollowers}>
          {formatFollowers(item.followers)} người theo dõi
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.followBtnSmall,
          item.isFollowed && styles.followBtnSmallFollowed,
        ]}
        onPress={() => onToggleFollow(item.id)}
      >
        {item.isFollowed ? (
          <Text style={styles.followSmallTextFollowed}>Đã theo dõi</Text>
        ) : (
          <Text style={styles.followSmallText}>Theo dõi</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  )
);

// ─── Main Screen ─────────────────────────────────────────────
interface OfficialAccountScreenProps {
  onBack: () => void;
}

export function OfficialAccountScreen({ onBack }: OfficialAccountScreenProps) {
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [suggestedOAs, setSuggestedOAs] = useState(SUGGESTED_OAS);
  const [allOAs, setAllOAs] = useState(ALL_OAS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleToggleFollow = useCallback((id: string) => {
    setSuggestedOAs((prev) =>
      prev.map((oa) =>
        oa.id === id ? { ...oa, isFollowed: !oa.isFollowed } : oa
      )
    );
    setAllOAs((prev) =>
      prev.map((oa) =>
        oa.id === id ? { ...oa, isFollowed: !oa.isFollowed } : oa
      )
    );
  }, []);

  const filteredOAs =
    activeCategory === "all"
      ? allOAs
      : allOAs.filter((oa) => oa.category === activeCategory);

  const searchFilteredOAs = searchText
    ? filteredOAs.filter((oa) =>
        oa.name.toLowerCase().includes(searchText.toLowerCase())
      )
    : filteredOAs;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Official Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm Official Account..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0068FF"]}
          />
        }
      >
        {/* Suggested Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedList}
          >
            {suggestedOAs.map((oa) => (
              <SuggestedCard
                key={oa.id}
                item={oa}
                onToggleFollow={handleToggleFollow}
              />
            ))}
          </ScrollView>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          style={styles.categoryScroll}
        >
          {OA_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                activeCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={activeCategory === cat.id ? "#fff" : "#555"}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  activeCategory === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* OA List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {activeCategory === "all"
              ? "Tất cả Official Account"
              : OA_CATEGORIES.find((c) => c.id === activeCategory)?.name || ""}
          </Text>
          {searchFilteredOAs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                Không tìm thấy Official Account
              </Text>
            </View>
          ) : (
            searchFilteredOAs.map((oa) => (
              <OAListItem
                key={oa.id}
                item={oa}
                onToggleFollow={handleToggleFollow}
              />
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0068FF",
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },

  // Search
  searchWrap: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },

  // Section
  section: {
    backgroundColor: "#fff",
    marginTop: 8,
    paddingVertical: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: "#0068FF",
    fontWeight: "500",
  },

  // Suggested Cards
  suggestedList: {
    paddingHorizontal: 14,
    gap: 12,
  },
  suggestedCard: {
    width: 180,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
  },
  suggestedCover: {
    width: "100%",
    height: 70,
    backgroundColor: "#e0e0e0",
  },
  suggestedBody: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
    marginTop: -22,
  },
  suggestedAvatarWrap: {
    position: "relative",
    marginBottom: 8,
  },
  suggestedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#e0e0e0",
  },
  verifiedBadgeSmall: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  suggestedName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  suggestedFollowers: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
    marginBottom: 10,
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0068FF",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
    width: "100%",
  },
  followBtnFollowed: {
    backgroundColor: "#f0f0f0",
  },
  followBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  followBtnTextFollowed: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
  },

  // Categories
  categoryScroll: {
    backgroundColor: "#fff",
    marginTop: 8,
  },
  categoryList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: "#0068FF",
  },
  categoryChipText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  // OA List
  oaListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  oaAvatarWrap: {
    position: "relative",
    marginRight: 12,
  },
  oaAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e0e0e0",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  oaInfo: {
    flex: 1,
    marginRight: 10,
  },
  oaName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 3,
  },
  oaDesc: {
    fontSize: 13,
    color: "#666",
    marginBottom: 3,
  },
  oaFollowers: {
    fontSize: 12,
    color: "#999",
  },
  followBtnSmall: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#E8F0FE",
  },
  followBtnSmallFollowed: {
    backgroundColor: "#f0f0f0",
  },
  followSmallText: {
    fontSize: 13,
    color: "#0068FF",
    fontWeight: "600",
  },
  followSmallTextFollowed: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
});
