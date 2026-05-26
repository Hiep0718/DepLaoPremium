import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PRODUCT_WIDTH = (SCREEN_WIDTH - 40) / 2;

// ─── Types ───────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  sold: number;
  rating: number;
  shop: string;
  isFreeShip: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const CATEGORIES: Category[] = [
  { id: "1", name: "Thời trang", icon: "👕" },
  { id: "2", name: "Điện tử", icon: "📱" },
  { id: "3", name: "Nhà cửa", icon: "🏠" },
  { id: "4", name: "Sức khỏe", icon: "💊" },
  { id: "5", name: "Mỹ phẩm", icon: "💄" },
  { id: "6", name: "Thể thao", icon: "⚽" },
  { id: "7", name: "Sách", icon: "📚" },
  { id: "8", name: "Đồ ăn", icon: "🍜" },
];

const FLASH_SALE_PRODUCTS: Product[] = [
  {
    id: "fs1",
    name: "Tai nghe Bluetooth không dây TWS",
    price: 89000,
    originalPrice: 250000,
    image: "https://picsum.photos/seed/earbuds/300/300",
    sold: 2341,
    rating: 4.8,
    shop: "Tech Store",
    isFreeShip: true,
  },
  {
    id: "fs2",
    name: "Áo thun nam cotton cao cấp",
    price: 59000,
    originalPrice: 180000,
    image: "https://picsum.photos/seed/tshirt/300/300",
    sold: 5672,
    rating: 4.6,
    shop: "Fashion Hub",
    isFreeShip: true,
  },
  {
    id: "fs3",
    name: "Bình giữ nhiệt inox 500ml",
    price: 45000,
    originalPrice: 150000,
    image: "https://picsum.photos/seed/bottle/300/300",
    sold: 8923,
    rating: 4.9,
    shop: "Home & Living",
    isFreeShip: false,
  },
];

const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Giày thể thao nam nữ sneaker phong cách Hàn Quốc",
    price: 199000,
    originalPrice: 450000,
    image: "https://picsum.photos/seed/shoes1/300/300",
    sold: 1256,
    rating: 4.7,
    shop: "Sneaker World",
    isFreeShip: true,
  },
  {
    id: "p2",
    name: "Balo laptop chống nước 15.6 inch cao cấp",
    price: 159000,
    originalPrice: 350000,
    image: "https://picsum.photos/seed/backpack/300/300",
    sold: 876,
    rating: 4.5,
    shop: "Bag Store",
    isFreeShip: true,
  },
  {
    id: "p3",
    name: "Đồng hồ thông minh Smart Watch theo dõi sức khỏe",
    price: 289000,
    originalPrice: 650000,
    image: "https://picsum.photos/seed/watch2/300/300",
    sold: 2134,
    rating: 4.8,
    shop: "Smart Gadget",
    isFreeShip: true,
  },
  {
    id: "p4",
    name: "Kem chống nắng UV Protection SPF50+",
    price: 79000,
    originalPrice: 200000,
    image: "https://picsum.photos/seed/sunscreen/300/300",
    sold: 4521,
    rating: 4.6,
    shop: "Beauty Zone",
    isFreeShip: false,
  },
  {
    id: "p5",
    name: "Bộ nồi chảo chống dính ceramic 3 món",
    price: 249000,
    originalPrice: 500000,
    image: "https://picsum.photos/seed/cookware/300/300",
    sold: 789,
    rating: 4.9,
    shop: "Kitchen Pro",
    isFreeShip: true,
  },
  {
    id: "p6",
    name: "Sạc dự phòng 20000mAh sạc nhanh PD",
    price: 179000,
    originalPrice: 400000,
    image: "https://picsum.photos/seed/powerbank/300/300",
    sold: 3456,
    rating: 4.7,
    shop: "Tech Store",
    isFreeShip: true,
  },
  {
    id: "p7",
    name: "Quần jogger nam nữ vải thun co giãn",
    price: 99000,
    originalPrice: 250000,
    image: "https://picsum.photos/seed/jogger/300/300",
    sold: 6789,
    rating: 4.5,
    shop: "Fashion Hub",
    isFreeShip: false,
  },
  {
    id: "p8",
    name: "Loa Bluetooth mini di động âm thanh sống động",
    price: 129000,
    originalPrice: 300000,
    image: "https://picsum.photos/seed/speaker/300/300",
    sold: 1567,
    rating: 4.8,
    shop: "Audio Plus",
    isFreeShip: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────
const formatPrice = (price: number): string => {
  return price.toLocaleString("vi-VN") + "đ";
};

const formatSold = (sold: number): string => {
  if (sold >= 1000) return (sold / 1000).toFixed(1) + "k";
  return sold.toString();
};

const getDiscount = (price: number, originalPrice?: number): number => {
  if (!originalPrice) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

// ─── Product Card Component ─────────────────────────────────
const ProductCard = React.memo(({ item }: { item: Product }) => {
  const discount = getDiscount(item.price, item.originalPrice);

  return (
    <TouchableOpacity style={styles.productCard} activeOpacity={0.7}>
      <View style={styles.productImageWrap}>
        <Image source={{ uri: item.image }} style={styles.productImage} />
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
        {item.isFreeShip && (
          <View style={styles.freeShipBadge}>
            <Text style={styles.freeShipText}>Freeship</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
          {item.originalPrice && (
            <Text style={styles.originalPrice}>
              {formatPrice(item.originalPrice)}
            </Text>
          )}
        </View>
        <View style={styles.productMeta}>
          <View style={styles.ratingWrap}>
            <Ionicons name="star" size={12} color="#FFC107" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
          <Text style={styles.soldText}>Đã bán {formatSold(item.sold)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Flash Sale Card ─────────────────────────────────────────
const FlashSaleCard = React.memo(({ item }: { item: Product }) => {
  const discount = getDiscount(item.price, item.originalPrice);

  return (
    <TouchableOpacity style={styles.flashCard} activeOpacity={0.7}>
      <Image source={{ uri: item.image }} style={styles.flashImage} />
      <Text style={styles.flashPrice}>{formatPrice(item.price)}</Text>
      {item.originalPrice && (
        <Text style={styles.flashOriginal}>
          {formatPrice(item.originalPrice)}
        </Text>
      )}
      <View style={styles.flashSoldBar}>
        <View
          style={[
            styles.flashSoldFill,
            { width: `${Math.min((item.sold / 10000) * 100, 95)}%` },
          ]}
        />
        <Text style={styles.flashSoldText}>
          Đã bán {formatSold(item.sold)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Main ZaloShopScreen ─────────────────────────────────────
interface ZaloShopScreenProps {
  onBack: () => void;
}

export function ZaloShopScreen({ onBack }: ZaloShopScreenProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cartCount] = useState(3);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm sản phẩm..."
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

        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="cart-outline" size={24} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#EE4D2D"]}
          />
        }
      >
        {/* Banner */}
        <View style={styles.bannerWrap}>
          <View style={styles.banner}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>🎉 MEGA SALE</Text>
              <Text style={styles.bannerSub}>Giảm đến 50% tất cả sản phẩm</Text>
              <TouchableOpacity style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Mua ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danh mục</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryItem,
                  selectedCategory === cat.id && styles.categoryItemActive,
                ]}
                onPress={() =>
                  setSelectedCategory(
                    selectedCategory === cat.id ? null : cat.id
                  )
                }
              >
                <View
                  style={[
                    styles.categoryIconWrap,
                    selectedCategory === cat.id &&
                      styles.categoryIconWrapActive,
                  ]}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.categoryName,
                    selectedCategory === cat.id && styles.categoryNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Flash Sale */}
        <View style={styles.section}>
          <View style={styles.flashHeader}>
            <View style={styles.flashTitleRow}>
              <Ionicons name="flash" size={20} color="#EE4D2D" />
              <Text style={styles.flashTitle}>Flash Sale</Text>
            </View>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={16} color="#EE4D2D" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.flashList}
          >
            {FLASH_SALE_PRODUCTS.map((item) => (
              <FlashSaleCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* Voucher Bar */}
        <View style={styles.voucherBar}>
          <View style={styles.voucherItem}>
            <Ionicons name="ticket-outline" size={20} color="#EE4D2D" />
            <Text style={styles.voucherText}>Mã giảm 30K</Text>
          </View>
          <View style={styles.voucherDivider} />
          <View style={styles.voucherItem}>
            <Ionicons name="car-outline" size={20} color="#EE4D2D" />
            <Text style={styles.voucherText}>Freeship 0đ</Text>
          </View>
          <View style={styles.voucherDivider} />
          <View style={styles.voucherItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#EE4D2D" />
            <Text style={styles.voucherText}>Chính hãng</Text>
          </View>
        </View>

        {/* Product Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
          <View style={styles.productGrid}>
            {PRODUCTS.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </View>
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
    backgroundColor: "#EE4D2D",
    paddingTop: 44,
    paddingBottom: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    paddingVertical: 0,
  },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    backgroundColor: "#FFD700",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#EE4D2D",
    fontSize: 11,
    fontWeight: "800",
  },
  scrollView: {
    flex: 1,
  },

  // Banner
  bannerWrap: {
    padding: 12,
    paddingBottom: 0,
  },
  banner: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EE4D2D",
  },
  bannerContent: {
    padding: 20,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  bannerSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 14,
  },
  bannerBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  bannerBtnText: {
    color: "#EE4D2D",
    fontSize: 14,
    fontWeight: "700",
  },

  // Section
  section: {
    backgroundColor: "#fff",
    marginTop: 10,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  // Categories
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
  },
  categoryItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 14,
  },
  categoryItemActive: {},
  categoryIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#f8f8f8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryIconWrapActive: {
    backgroundColor: "#FFF0ED",
    borderWidth: 1.5,
    borderColor: "#EE4D2D",
  },
  categoryIcon: {
    fontSize: 26,
  },
  categoryName: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
    textAlign: "center",
  },
  categoryNameActive: {
    color: "#EE4D2D",
    fontWeight: "700",
  },

  // Flash Sale
  flashHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  flashTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flashTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#EE4D2D",
    textTransform: "uppercase",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 13,
    color: "#EE4D2D",
    fontWeight: "500",
  },
  flashList: {
    paddingHorizontal: 14,
    gap: 10,
  },
  flashCard: {
    width: 120,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
  },
  flashImage: {
    width: 120,
    height: 120,
    backgroundColor: "#f0f0f0",
  },
  flashPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EE4D2D",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  flashOriginal: {
    fontSize: 11,
    color: "#999",
    textDecorationLine: "line-through",
    paddingHorizontal: 8,
    marginTop: 2,
  },
  flashSoldBar: {
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 8,
    height: 16,
    backgroundColor: "#FFDDD3",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
  },
  flashSoldFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#EE4D2D",
    borderRadius: 8,
  },
  flashSoldText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    zIndex: 1,
  },

  // Voucher Bar
  voucherBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "space-around",
  },
  voucherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voucherText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
  },
  voucherDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#eee",
  },

  // Product Grid
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    gap: 10,
  },
  productCard: {
    width: PRODUCT_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 2,
  },
  productImageWrap: {
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: PRODUCT_WIDTH,
    backgroundColor: "#f0f0f0",
  },
  discountBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EE4D2D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
  },
  discountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  freeShipBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#00BFA5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  freeShipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  productInfo: {
    padding: 8,
  },
  productName: {
    fontSize: 13,
    color: "#333",
    lineHeight: 18,
    marginBottom: 6,
    minHeight: 36,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EE4D2D",
  },
  originalPrice: {
    fontSize: 11,
    color: "#999",
    textDecorationLine: "line-through",
  },
  productMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  soldText: {
    fontSize: 11,
    color: "#999",
  },
});
